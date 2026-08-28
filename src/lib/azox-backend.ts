import { supabase } from "@/integrations/supabase/client";
import { getStartParam, getTelegramUser } from "@/lib/telegram";

/** The external project's user tables are not in the generated types. */
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<any>;
};

export type DbUser = {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  points: number;
  tasks_done: number;
  referral_code: string | null;
  referred_by: number | null;
  referral_count: number;
  photo_url: string | null;
  rank: string | null;
  joined_at: string | null;
  last_seen: string | null;
};

export const BOT_USERNAME = "AZOX_Airdrop_bot";

export function referralLinkFor(code: string | null | undefined): string {
  return `https://t.me/${BOT_USERNAME}?start=${code ?? ""}`;
}

export function currentTelegramId(): number | null {
  const tg = getTelegramUser();
  return tg?.id ?? null;
}

/** Upserts the Telegram user then returns the fresh row. Null outside Telegram. */
export async function syncTelegramUser(): Promise<DbUser | null> {
  console.log("[azox-backend] Supabase URL:", (supabase as any).supabaseUrl ?? "unknown");
  const tg = getTelegramUser();
  console.log("[azox-backend] tg user from Telegram:", tg);
  if (!tg) return null;
  const base = {
    p_telegram_id: tg.id,
    p_username: tg.username ?? null,
    p_first_name: tg.first_name ?? null,
    p_last_name: tg.last_name ?? null,
    p_referral_code: getStartParam() || null,
  };
  try {
    // Preferred: the overload that also stores the Telegram avatar.
    let { data: rpcData, error: rpcError } = await db.rpc("upsert_user", {
      ...base,
      p_photo_url: tg.photo_url ?? null,
    });
    if (rpcError) {
      // Older database without the p_photo_url overload — retry without it.
      console.warn("[azox-backend] upsert_user with photo_url failed:", rpcError);
      ({ data: rpcData, error: rpcError } = await db.rpc("upsert_user", base));
    }
    if (rpcError) console.error("[azox-backend] upsert_user RPC error:", rpcError);
    else console.log("[azox-backend] upsert_user success:", rpcData);
  } catch (e) {
    console.error("[azox-backend] upsert_user failed", e);
  }
  return fetchUser(tg.id);
}

export async function fetchUser(telegramId: number): Promise<DbUser | null> {
  try {
    const { data, error } = await db
      .from("users")
      .select("*")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    if (error) throw error;
    return (data as DbUser) ?? null;
  } catch (e) {
    console.error("[azox-backend] fetchUser failed", e);
    return null;
  }
}

/** Adds points server-side; returns the authoritative total when available. */
export async function addPointsRemote(amount: number): Promise<number | null> {
  const telegramId = currentTelegramId();
  if (!telegramId || amount === 0) return null;
  try {
    const { data, error } = await db.rpc("add_points", {
      p_telegram_id: telegramId,
      p_points: amount,
    });
    if (error) throw error;
    if (typeof data === "number") return data;
    if (data && typeof data === "object" && typeof data.points === "number") {
      return data.points as number;
    }
    const user = await fetchUser(telegramId);
    return user?.points ?? null;
  } catch (e) {
    console.error("[azox-backend] add_points failed", e);
    return null;
  }
}

/** True number of unique tasks completed by a user (source of truth). */
export async function fetchTaskCount(telegramId: number): Promise<number> {
  try {
    const { count, error } = await db
      .from("user_tasks")
      .select("task_id", { count: "exact", head: true })
      .eq("telegram_id", telegramId);
    if (error) throw error;
    return count ?? 0;
  } catch (e) {
    console.error("[azox-backend] fetchTaskCount failed", e);
    return 0;
  }
}

/** Unique task counts for every user, keyed by telegram_id. */
export async function fetchAllTaskCounts(): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  try {
    const { data, error } = await db
      .from("user_tasks")
      .select("telegram_id, task_id")
      .limit(50000);
    if (error) throw error;
    const seen = new Set<string>();
    for (const row of (data ?? []) as {
      telegram_id: number;
      task_id: string;
    }[]) {
      const key = `${row.telegram_id}:${row.task_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counts.set(row.telegram_id, (counts.get(row.telegram_id) ?? 0) + 1);
    }
  } catch (e) {
    console.error("[azox-backend] fetchAllTaskCounts failed", e);
  }
  return counts;
}

/**
 * Records a completed task exactly once (telegram_id + task_id), then mirrors
 * the real user_tasks count into users.tasks_done.
 */
export async function recordTaskCompletion(
  taskId: string,
  points = 0,
): Promise<void> {
  const telegramId = currentTelegramId();
  if (!telegramId) return;
  try {
    const { data: existing } = await db
      .from("user_tasks")
      .select("task_id")
      .eq("telegram_id", telegramId)
      .eq("task_id", taskId)
      .maybeSingle();

    if (!existing) {
      await db
        .from("user_tasks")
        .upsert(
          { telegram_id: telegramId, task_id: taskId },
          { onConflict: "telegram_id,task_id" },
        );
    }

    const realCount = await fetchTaskCount(telegramId);
    await db
      .from("users")
      .update({ tasks_done: realCount })
      .eq("telegram_id", telegramId);
  } catch (e) {
    console.error("[azox-backend] recordTaskCompletion failed", e);
  }
  if (points > 0) await addPointsRemote(points);
}

/**
 * Records N task units under one logical achievement (baseId), idempotently.
 * Each unit is a distinct row in user_tasks, so the real count stays truthful
 * and a repeated award for the same achievement never double-counts.
 */
export async function recordTaskUnits(
  baseId: string,
  units: number,
): Promise<number> {
  const telegramId = currentTelegramId();
  if (!telegramId || units <= 0) return 0;
  const ids = Array.from({ length: units }, (_, i) =>
    i === 0 ? baseId : `${baseId}#${i + 1}`,
  );
  try {
    const { data: existing } = await db
      .from("user_tasks")
      .select("task_id")
      .eq("telegram_id", telegramId)
      .in("task_id", ids);
    const have = new Set(
      ((existing ?? []) as { task_id: string }[]).map((r) => r.task_id),
    );
    const missing = ids.filter((id) => !have.has(id));
    if (missing.length) {
      await db.from("user_tasks").upsert(
        missing.map((task_id) => ({ telegram_id: telegramId, task_id })),
        { onConflict: "telegram_id,task_id" },
      );
    }
    const realCount = await fetchTaskCount(telegramId);
    await db
      .from("users")
      .update({ tasks_done: realCount })
      .eq("telegram_id", telegramId);
    return missing.length;
  } catch (e) {
    console.error("[azox-backend] recordTaskUnits failed", e);
    return 0;
  }
}

/** Re-syncs users.tasks_done from the real user_tasks rows. */
export async function syncTasksDone(): Promise<number> {
  const telegramId = currentTelegramId();
  if (!telegramId) return 0;
  const realCount = await fetchTaskCount(telegramId);
  try {
    await db
      .from("users")
      .update({ tasks_done: realCount })
      .eq("telegram_id", telegramId);
  } catch (e) {
    console.error("[azox-backend] syncTasksDone failed", e);
  }
  return realCount;
}



/** Saves a game score (one row per game per user). */
export async function saveGameScore(
  gameId: string,
  score: number,
): Promise<void> {
  const telegramId = currentTelegramId();
  if (!telegramId || !Number.isFinite(score)) return;
  try {
    await db.from("game_scores").upsert(
      {
        telegram_id: telegramId,
        game_id: gameId,
        score,
        is_best: true,
      },
      { onConflict: "telegram_id,game_id" },
    );
  } catch (e) {
    console.error("[azox-backend] saveGameScore failed", e);
  }
}

export type LeaderboardRow = {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  points: number;
  tasks_done: number;
  referral_count: number;
  rank: string | null;
  photo_url: string | null;
};

export function displayName(row: {
  username: string | null;
  first_name: string | null;
}): string {
  return row.username ? `@${row.username}` : (row.first_name ?? "AZOX Player");
}

export async function fetchLeaderboard(
  column: "points" | "tasks_done" | "referral_count",
  limit = 100,
): Promise<LeaderboardRow[]> {
  try {
    const { data, error } = await db
      .from("users")
      .select("telegram_id, username, first_name, last_name, points, tasks_done, referral_count, rank, photo_url")
      .order(column, { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as LeaderboardRow[]) ?? [];
  } catch (e) {
    console.error("[azox-backend] fetchLeaderboard failed", e);
    return [];
  }
}

/* ------------------------------- Referrals ------------------------------- */

export type ReferredUser = {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  points: number;
  joined_at: string | null;
};

/**
 * Attributes the current Telegram user to the owner of `code`.
 * The database enforces one-time attribution and the single +1000 reward.
 * Returns true only when a brand-new referral was recorded.
 */
export async function registerReferral(code: string | null): Promise<boolean> {
  const telegramId = currentTelegramId();
  if (!telegramId || !code) return false;
  try {
    const { data, error } = await db.rpc("register_referral", {
      p_referred_id: telegramId,
      p_referral_code: code,
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.error("[azox-backend] register_referral failed", e);
    return false;
  }
}

/** Users who joined through this user's referral link. */
export async function fetchReferredUsers(
  telegramId: number,
): Promise<ReferredUser[]> {
  try {
    const { data, error } = await db
      .from("users")
      .select("telegram_id, username, first_name, last_name, photo_url, points, joined_at")
      .eq("referred_by", telegramId)
      .order("joined_at", { ascending: false });
    if (error) throw error;
    return (data as ReferredUser[]) ?? [];
  } catch (e) {
    console.error("[azox-backend] fetchReferredUsers failed", e);
    return [];
  }
}

export type WalletRegistration = {
  wallet_address: string;
  registered_at: string | null;
};

/** ANY row for this telegram_id means the user is registered forever. */
export async function fetchWalletRegistration(
  telegramId: number,
): Promise<WalletRegistration | null> {
  try {
    const { data, error } = await db
      .from("wallet_registrations")
      .select("wallet_address, registered_at")
      .eq("telegram_id", telegramId)
      .order("registered_at", { ascending: true })
      .limit(1);
    if (error) throw error;
    const row = (data as WalletRegistration[] | null)?.[0];
    return row ?? null;
  } catch (e) {
    console.error("[azox-backend] fetchWalletRegistration failed", e);
    return null;
  }
}

/** Saves a first-time registration and flags the user as airdrop registered. */
export async function saveWalletRegistration(params: {
  telegramId: number;
  walletAddress: string;
  chainId: number;
  txHash: string;
}): Promise<WalletRegistration | null> {
  try {
    const existing = await fetchWalletRegistration(params.telegramId);
    if (existing) return existing;

    const { error } = await db.from("wallet_registrations").insert({
      telegram_id: params.telegramId,
      wallet_address: params.walletAddress,
      chain_id: params.chainId,
      registration_fee: "0.0006",
      payment_tx_hash: params.txHash,
      payment_status: "confirmed",
      is_current: true,
    });
    if (error) throw error;

    const { error: userError } = await db
      .from("users")
      .update({ airdrop_registered: true })
      .eq("telegram_id", params.telegramId);
    if (userError) console.error("[azox-backend] airdrop_registered update failed", userError);

    return await fetchWalletRegistration(params.telegramId);
  } catch (e) {
    console.error("[azox-backend] saveWalletRegistration failed", e);
    return null;
  }
}
