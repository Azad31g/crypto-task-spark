import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/points";
import { getStartParam, getTelegramUser, initTelegram, type TelegramUser } from "@/lib/telegram";
import {
  referralLinkFor,
  syncTelegramUser,
  fetchUser,
  registerReferral,
  type DbUser,
} from "@/lib/azox-backend";

export type AzoxUser = {
  id: string;
  name: string;
  username: string;
  initials: string;
  photoUrl: string | null;
  isTelegram: boolean;
  joinedAt: string;
  referralLink: string;
};

const GUEST: AzoxUser = {
  id: "guest",
  name: "AZOX Player",
  username: "azox_player",
  initials: "AZ",
  photoUrl: null,
  isTelegram: false,
  joinedAt: new Date().toISOString().slice(0, 10),
  referralLink: referralLinkFor("azox_player"),
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AZ";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function fromTelegram(tg: TelegramUser, joinedAt: string): AzoxUser {
  const name =
    [tg.first_name, tg.last_name].filter(Boolean).join(" ") ||
    tg.username ||
    "AZOX Player";
  const username = tg.username ?? `azox_${tg.id}`;
  return {
    id: String(tg.id),
    name,
    username,
    initials: initialsOf(name),
    photoUrl: tg.photo_url ?? null,
    isTelegram: true,
    joinedAt,
    referralLink: referralLinkFor(username),
  };
}

function fromDb(row: DbUser, fallback: AzoxUser): AzoxUser {
  // Live Telegram data (the fallback) always wins over stored values.
  const live = fallback.isTelegram;
  const name = live
    ? fallback.name
    : [row.first_name, row.last_name].filter(Boolean).join(" ") ||
      row.username ||
      fallback.name;
  return {
    ...fallback,
    id: String(row.telegram_id),
    name,
    username: (live ? fallback.username : null) ?? row.username ?? fallback.username,
    photoUrl: fallback.photoUrl ?? row.photo_url ?? null,
    initials: initialsOf(name),
    isTelegram: true,
    joinedAt: row.joined_at ? row.joined_at.slice(0, 10) : fallback.joinedAt,
    referralLink: referralLinkFor(row.referral_code ?? row.username),
  };
}

export function useUser() {
  const [user, setUser] = useState<AzoxUser>(GUEST);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Step 1: Try to get Telegram user IMMEDIATELY (synchronous)
    const tgUser = getTelegramUser();

    if (tgUser) {
      // We have real Telegram data - use it immediately, no fallback
      const stored = readStorage<AzoxUser | null>(STORAGE_KEYS.user, null);
      const joinedAt = stored?.joinedAt ?? new Date().toISOString().slice(0, 10);
      const local = fromTelegram(tgUser, joinedAt);
      setUser(local);
      writeStorage(STORAGE_KEYS.user, local);
      setReady(true);

      // Step 2: Sync with Supabase in background
      void syncTelegramUser().then(async (row) => {
        if (cancelled || !row) return;
        // Referral attribution (database enforces one-time reward).
        const startParam = getStartParam();
        if (startParam) {
          const awarded = await registerReferral(startParam);
          if (awarded) {
            const fresh = await fetchUser(row.telegram_id);
            if (fresh) row = fresh;
          }
        }
        if (cancelled) return;
        setDbUser(row);
        // Merge but keep live Telegram data for display
        const merged = {
          ...fromDb(row, local),
          // Always prefer live Telegram data for display
          name: local.name,
          username: local.username,
          initials: local.initials,
          photoUrl: tgUser.photo_url ?? row.photo_url ?? null,
          isTelegram: true,
        };
        setUser(merged);
        writeStorage(STORAGE_KEYS.user, merged);
      });
    } else {
      // No Telegram - use stored or guest
      const stored = readStorage<AzoxUser | null>(STORAGE_KEYS.user, null);
      const joinedAt = stored?.joinedAt ?? new Date().toISOString().slice(0, 10);
      const local = stored ?? { ...GUEST, joinedAt };
      setUser(local);
      setReady(true);
    }

    // Step 3: Initialize Telegram WebApp
    initTelegram();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshDbUser = useCallback(async () => {
    if (!dbUser) return null;
    const row = await fetchUser(dbUser.telegram_id);
    if (row) setDbUser(row);
    return row;
  }, [dbUser]);

  const updateUser = useCallback((patch: Partial<AzoxUser>) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      writeStorage(STORAGE_KEYS.user, next);
      return next;
    });
  }, []);

  return { user, dbUser, ready, updateUser, refreshDbUser };
}
