/* eslint-disable @typescript-eslint/no-explicit-any -- untyped external project tables */
// Server-only helpers for verified AZOX writes (service-role client).
import { getExternalSupabaseAdmin } from "@/integrations/external-supabase/admin.server";
import { RANK_THRESHOLDS_PAYLOAD } from "./rewards";
import { parseRpcStatus, type RpcClaimStatus } from "./claim-status";

type Db = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<any>;
};

export function db(): Db {
  return getExternalSupabaseAdmin() as unknown as Db;
}

export type PointsResult = { points: number; rank: string | null };

function parsePoints(data: any): PointsResult | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const points = Number(row.points);
  if (!Number.isFinite(points)) return null;
  return { points, rank: typeof row.rank === "string" ? row.rank : null };
}

/** Repeatable reward (or p_points = 0 to recompute rank only). */
export async function grantPoints(telegramId: number, points: number): Promise<PointsResult> {
  const { data, error } = await db().rpc("grant_points", {
    p_telegram_id: telegramId,
    p_points: points,
    p_thresholds: RANK_THRESHOLDS_PAYLOAD,
  });
  if (error) throw new Error(`grant_points: ${error.message}`);
  const parsed = parsePoints(data);
  if (!parsed) throw new Error("grant_points: unexpected response");
  return parsed;
}

/** Once-only reward keyed by event_key. */
export async function claimOnce(
  telegramId: number,
  eventKey: string,
  points: number,
): Promise<PointsResult & { granted: boolean }> {
  const { data, error } = await db().rpc("claim_reward", {
    p_telegram_id: telegramId,
    p_event_key: eventKey,
    p_points: points,
    p_thresholds: RANK_THRESHOLDS_PAYLOAD,
  });
  if (error) throw new Error(`claim_reward: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  const parsed = parsePoints(row);
  if (!parsed) throw new Error("claim_reward: unexpected response");
  return { ...parsed, granted: row?.granted === true };
}

export async function currentPoints(telegramId: number): Promise<number> {
  const { data, error } = await db()
    .from("users")
    .select("points")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (error) throw new Error(`users read: ${error.message}`);
  return Number(data?.points ?? 0) || 0;
}

/** Recomputes users.tasks_done from the real user_tasks count. */
export async function recomputeTasksDone(telegramId: number): Promise<number> {
  const { count, error } = await db()
    .from("user_tasks")
    .select("task_id", { count: "exact", head: true })
    .eq("telegram_id", telegramId);
  if (error) throw new Error(`user_tasks count: ${error.message}`);
  const real = count ?? 0;
  const { error: upErr } = await db()
    .from("users")
    .update({ tasks_done: real })
    .eq("telegram_id", telegramId);
  if (upErr) throw new Error(`tasks_done update: ${upErr.message}`);
  return real;
}

/** Inserts the given task ids once each; returns how many were new. */
export async function insertTaskIds(telegramId: number, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data: existing, error } = await db()
    .from("user_tasks")
    .select("task_id")
    .eq("telegram_id", telegramId)
    .in("task_id", ids);
  if (error) throw new Error(`user_tasks read: ${error.message}`);
  const have = new Set(((existing ?? []) as { task_id: string }[]).map((r) => r.task_id));
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length) {
    const { error: upErr } = await db()
      .from("user_tasks")
      .upsert(
        missing.map((task_id) => ({ telegram_id: telegramId, task_id })),
        { onConflict: "telegram_id,task_id", ignoreDuplicates: true },
      );
    if (upErr) throw new Error(`user_tasks upsert: ${upErr.message}`);
  }
  return missing.length;
}

export function unitIds(baseId: string, units: number): string[] {
  return Array.from({ length: units }, (_, i) => (i === 0 ? baseId : `${baseId}#${i + 1}`));
}

/** Social task definition from the tasks table (authoritative reward values). */
export async function findTask(taskId: string): Promise<{
  points: number;
  taskReward: number;
  platform: string;
  url: string;
} | null> {
  const { data } = await db()
    .from("tasks")
    .select("id, platform, url, points, task_reward")
    .eq("id", taskId)
    .maybeSingle();
  if (!data) return null;
  return {
    points: Math.max(0, Number(data.points) || 0),
    taskReward: Math.max(0, Math.min(100, Number(data.task_reward) || 0)),
    platform: String(data.platform ?? "").toLowerCase(),
    url: String(data.url ?? ""),
  };
}

/** True when the user already has this reward_events key. */
export async function hasEvent(telegramId: number, key: string): Promise<boolean> {
  const { data, error } = await db()
    .from("reward_events")
    .select("id")
    .eq("telegram_id", telegramId)
    .eq("event_key", key)
    .maybeSingle();
  if (error) throw new Error(`reward_events read: ${error.message}`);
  return Boolean(data);
}

/** Count of the given reward_events keys the user holds. */
export async function countEvents(telegramId: number, keys: string[]): Promise<number> {
  const { data, error } = await db()
    .from("reward_events")
    .select("event_key")
    .eq("telegram_id", telegramId)
    .in("event_key", keys);
  if (error) throw new Error(`reward_events read: ${error.message}`);
  return new Set(((data ?? []) as { event_key: string }[]).map((r) => r.event_key)).size;
}

/** Most recent reward_events row whose key starts with `prefix`. */
export async function lastEvent(
  telegramId: number,
  prefix: string,
): Promise<{ id: string; created_at: string } | null> {
  const { data, error } = await db()
    .from("reward_events")
    .select("id, created_at")
    .eq("telegram_id", telegramId)
    .like("event_key", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`reward_events read: ${error.message}`);
  const row = (data as { id: string | number; created_at: string }[] | null)?.[0];
  return row ? { id: String(row.id), created_at: row.created_at } : null;
}

/** Telegram getChatMember with the server-side bot token. */
export async function isTelegramMember(chat: string, userId: number): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return false;
  const res = await fetch(
    `https://api.telegram.org/bot${token}/getChatMember?chat_id=@${encodeURIComponent(
      chat,
    )}&user_id=${userId}`,
  );
  const body = (await res.json()) as { ok?: boolean; result?: { status?: string } };
  return (
    body.ok === true && ["member", "administrator", "creator"].includes(body.result?.status ?? "")
  );
}

/** Instagram follow verified by the Meta webhook flow. */
export async function isInstagramVerified(userId: number, taskId: string): Promise<boolean> {
  const { data } = await db()
    .from("instagram_verifications")
    .select("status")
    .eq("telegram_user_id", userId)
    .eq("task_id", taskId)
    .maybeSingle();
  return data?.status === "verified";
}

export function utcDay(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Atomic Main Tap batch (row-locked; idempotent per batch id). */
export async function claimTapBatch(
  telegramId: number,
  batchId: string,
  units: number,
): Promise<RpcClaimStatus> {
  const { RANKS } = await import("./ranks");
  const { TAP_MIN_INTERVAL_SECONDS } = await import("./rate-limits");
  const { TAP_BATCH_MAX_UNITS } = await import("./tap-batch");
  const { data, error } = await db().rpc("claim_tap_batch", {
    p_telegram_id: telegramId,
    p_batch_id: batchId,
    p_units: units,
    p_ranks: RANKS.map(({ key, threshold, pointsPerFinger }) => ({
      key,
      threshold,
      perFinger: pointsPerFinger,
    })),
    p_min_interval_seconds: TAP_MIN_INTERVAL_SECONDS,
    p_max_units: TAP_BATCH_MAX_UNITS,
  });
  if (error) throw new Error(`claim_tap_batch: ${error.message}`);
  const parsed = parseRpcStatus(data);
  if (!parsed) throw new Error("claim_tap_batch: unexpected response");
  return parsed;
}

/** Atomic arcade score payout with cooldown, per-claim and hourly caps. */
export async function claimGameScore(
  telegramId: number,
  gameId: string,
  score: number,
): Promise<RpcClaimStatus> {
  const r = await import("./rate-limits");
  const { data, error } = await db().rpc("claim_game_score", {
    p_telegram_id: telegramId,
    p_game_id: gameId,
    p_score: score,
    p_thresholds: RANK_THRESHOLDS_PAYLOAD,
    p_min_interval_seconds: r.GAME_SCORE_MIN_INTERVAL_SECONDS,
    p_max_score: r.GAME_SCORE_MAX_PER_CLAIM,
    p_max_points_per_hour: r.GAME_SCORE_MAX_POINTS_PER_HOUR,
  });
  if (error) throw new Error(`claim_game_score: ${error.message}`);
  const parsed = parseRpcStatus(data);
  if (!parsed) throw new Error("claim_game_score: unexpected response");
  return parsed;
}
