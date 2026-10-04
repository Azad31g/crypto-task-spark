import { externalSupabase as supabase } from "@/integrations/external-supabase/client";
import { getTelegramUser, getWebApp } from "@/lib/telegram";
import type { RewardClaim, ScoreGame, TaskUnitKind } from "@/lib/rewards";
import {
  claimReward as claimRewardFn,
  completeDailyGame as completeDailyGameFn,
  globalButtonPress as globalButtonPressFn,
  recordTask as recordTaskFn,
  recordTaskUnits as recordTaskUnitsFn,
  registerAirdropWallet as registerAirdropWalletFn,
  submitGameScore as submitGameScoreFn,
  syncTasksDone as syncTasksDoneFn,
  syncUser as syncUserFn,
} from "@/lib/azox-secure.functions";

/** Raw signed Telegram initData — the only identity sent for writes. */
export function rawInitData(): string | null {
  return getWebApp()?.initData || null;
}

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

export { referralLinkFor } from "@/lib/referral-link";

export function currentTelegramId(): number | null {
  const tg = getTelegramUser();
  return tg?.id ?? null;
}

/** Upserts the verified Telegram user on the server, then returns the row. */
export async function syncTelegramUser(): Promise<DbUser | null> {
  const tg = getTelegramUser();
  if (!tg) return null;
  const initData = rawInitData();
  if (initData) {
    try {
      const res = await syncUserFn({ data: { initData } });
      if (res.ok) return res.user as unknown as DbUser;
      console.warn("[azox-backend] syncUser rejected:", res.error);
    } catch (e) {
      console.error("[azox-backend] syncUser failed", e);
    }
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

/**
 * Asks the server to pay a reward. The server decides the amount for fixed
 * rewards; returns the authoritative total when available.
 */
/** In-flight reward claims; follow-up task writes wait for them. */
let pendingClaims: Promise<unknown> = Promise.resolve();

export function claimRewardRemote(claim: RewardClaim): Promise<number | null> {
  const p = doClaimReward(claim);
  pendingClaims = Promise.allSettled([pendingClaims, p]);
  return p;
}

async function doClaimReward(claim: RewardClaim): Promise<number | null> {
  if (claim.type === "none") return null;
  const initData = rawInitData();
  if (!initData) return null;
  try {
    const res =
      claim.type === "global_button"
        ? await globalButtonPressFn({ data: { initData } })
        : claim.type === "daily_batch"
          ? await completeDailyGameFn({
              data: { initData, game: claim.game, indices: claim.indices },
            })
          : await claimRewardFn({ data: { initData, claim } });
    if (res.ok) return res.points;
    console.warn("[azox-backend] reward rejected:", claim.type, res.error);
  } catch (e) {
    console.error("[azox-backend] reward failed", e);
  }
  const id = currentTelegramId();
  if (!id) return null;
  const user = await fetchUser(id);
  return user?.points ?? null;
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
    const { data, error } = await db.from("user_tasks").select("telegram_id, task_id").limit(50000);
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

/** Records a social task (and its bonus task units) on the server. */
export async function recordTaskCompletion(taskId: string): Promise<void> {
  await pendingClaims;
  const initData = rawInitData();
  if (!initData) return;
  try {
    const res = await recordTaskFn({ data: { initData, taskId } });
    if (!res.ok) console.warn("[azox-backend] recordTask rejected:", res.error);
  } catch (e) {
    console.error("[azox-backend] recordTaskCompletion failed", e);
  }
}

/** Game achievement task units; the server decides ids and unit counts. */
export async function recordTaskUnits(kind: TaskUnitKind): Promise<number> {
  await pendingClaims;
  const initData = rawInitData();
  if (!initData) return 0;
  try {
    const res = await recordTaskUnitsFn({ data: { initData, kind } });
    if (res.ok) return res.added;
    console.warn("[azox-backend] recordTaskUnits rejected:", res.error);
  } catch (e) {
    console.error("[azox-backend] recordTaskUnits failed", e);
  }
  return 0;
}

/** Re-syncs users.tasks_done on the server from the real user_tasks rows. */
export async function syncTasksDone(): Promise<number> {
  const telegramId = currentTelegramId();
  if (!telegramId) return 0;
  const initData = rawInitData();
  if (initData) {
    try {
      const res = await syncTasksDoneFn({ data: { initData } });
      if (res.ok) return res.tasksDone;
    } catch (e) {
      console.error("[azox-backend] syncTasksDone failed", e);
    }
  }
  return fetchTaskCount(telegramId);
}

/**
 * Submits a score for the global best. Returns task units earned (10 only
 * when the server stored a new world record).
 */
export async function submitGameScoreRemote(gameId: ScoreGame, score: number): Promise<number> {
  const initData = rawInitData();
  if (!initData || !Number.isInteger(score) || score <= 0) return 0;
  try {
    const res = await submitGameScoreFn({ data: { initData, gameId, score } });
    if (res.ok) return res.earnedTasks;
    console.warn("[azox-backend] submitGameScore rejected:", res.error);
  } catch (e) {
    console.error("[azox-backend] submitGameScore failed", e);
  }
  return 0;
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

export function displayName(row: { username: string | null; first_name: string | null }): string {
  return row.username ? `@${row.username}` : (row.first_name ?? "AZOX Player");
}

export async function fetchLeaderboard(
  column: "points" | "tasks_done" | "referral_count",
  limit = 100,
): Promise<LeaderboardRow[]> {
  try {
    const { data, error } = await db
      .from("users")
      .select(
        "telegram_id, username, first_name, last_name, points, tasks_done, referral_count, rank, photo_url",
      )
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
 * No-op: referral attribution (+1000 to the referrer) happens inside the
 * server-side upsert_user call when the user row is first created.
 */
export async function registerReferral(_code: string | null): Promise<boolean> {
  return false;
}

/** Users who joined through this user's referral link. */
export async function fetchReferredUsers(telegramId: number): Promise<ReferredUser[]> {
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

/**
 * Server verifies the payment on chain 46630, then saves the first
 * registration and flags the user as airdrop registered.
 */
export async function saveWalletRegistration(params: {
  walletAddress: string;
  txHash: string;
}): Promise<WalletRegistration | null> {
  const initData = rawInitData();
  if (!initData) return null;
  try {
    const res = await registerAirdropWalletFn({ data: { initData, ...params } });
    if (res.ok) return (res.registration as WalletRegistration | null) ?? null;
    console.warn("[azox-backend] registerAirdropWallet rejected:", res.error);
  } catch (e) {
    console.error("[azox-backend] saveWalletRegistration failed", e);
  }
  return null;
}
