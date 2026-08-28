import { RANKS, nextRank, rankForPoints, type Rank, type RankKey } from "./azox-data";

export const STORAGE_KEYS = {
  points: "azox:points:v1",
  user: "azox:user:v1",
  tasks: "azox:tasks:v1",
} as const;

export type { Rank, RankKey };
export { RANKS, rankForPoints, nextRank };

/** Rank thresholds keyed by rank name. */
export const RANK_THRESHOLDS: Record<RankKey, number> = RANKS.reduce(
  (acc, r) => {
    acc[r.key] = r.threshold;
    return acc;
  },
  {} as Record<RankKey, number>,
);

export function pointsPerTap(points: number, fingers = 1): number {
  return Math.max(1, fingers) * rankForPoints(points).pointsPerFinger;
}

/** 1-based level inside the current rank: every 1000 points = 1 level. */
export function levelForPoints(points: number): number {
  const rank = rankForPoints(points);
  return Math.floor((points - rank.threshold) / 1000) + 1;
}

/** Progress (0-100) toward the next rank. */
export function progressToNextRank(points: number): number {
  const rank = rankForPoints(points);
  const next = nextRank(points);
  if (!next) return 100;
  const span = next.threshold - rank.threshold;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, ((points - rank.threshold) / span) * 100));
}

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode) — keep running in memory
  }
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
