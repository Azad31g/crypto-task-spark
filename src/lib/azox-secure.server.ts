// Server-only helpers for verified AZOX writes (service-role client).
import { getExternalSupabaseAdmin } from "@/integrations/external-supabase/admin.server";
import { RANK_THRESHOLDS_PAYLOAD } from "./rewards";

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
export async function findTask(
  taskId: string,
): Promise<{ points: number; taskReward: number } | null> {
  const { data } = await db()
    .from("tasks")
    .select("id, points, task_reward")
    .eq("id", taskId)
    .maybeSingle();
  if (!data) return null;
  return {
    points: Math.max(0, Number(data.points) || 0),
    taskReward: Math.max(0, Math.min(100, Number(data.task_reward) || 0)),
  };
}

export function utcDay(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}
