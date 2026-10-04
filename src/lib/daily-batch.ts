// Pure end-of-game batch reward logic for AZOX Word and Question Day.
// No IO: the server wires real calls in; tests use an in-memory fake.
//
// LIMITATION: the browser still decides which answers were correct. The
// server only bounds the indices, fixes the amounts, and pays each
// day/index once (reward_events unique key via claim_reward).
import {
  QUESTION_POINTS,
  QUESTIONS_PER_DAY,
  TASK_UNITS,
  WORD_POINTS,
  WORDS_PER_DAY,
} from "./rewards";

export type DailyGame = "word" | "question";

export const DAILY_GAMES: Record<
  DailyGame,
  {
    prefix: string;
    points: number;
    count: number;
    unitKind: "word_complete" | "question_complete";
    unitBase: string;
  }
> = {
  word: {
    prefix: "word",
    points: WORD_POINTS,
    count: WORDS_PER_DAY,
    unitKind: "word_complete",
    unitBase: "game-word-complete",
  },
  question: {
    prefix: "question",
    points: QUESTION_POINTS,
    count: QUESTIONS_PER_DAY,
    unitKind: "question_complete",
    unitBase: "game-question-complete",
  },
};

/** Validates and dedupes indices; returns null if any index is out of range. */
export function normalizeIndices(game: DailyGame, indices: number[]): number[] | null {
  const { count } = DAILY_GAMES[game];
  if (indices.length > count) return null;
  for (const i of indices) if (!Number.isInteger(i) || i < 0 || i >= count) return null;
  return [...new Set(indices)].sort((a, b) => a - b);
}

export function rewardKey(game: DailyGame, day: string, index: number): string {
  return `${DAILY_GAMES[game].prefix}-${day}-${index}`;
}

export type DailyBatchDeps = {
  /** claim_reward: once-only by key; the amount comes from this module. */
  claimOnce: (key: string, points: number) => Promise<{ granted: boolean; points: number }>;
  /** Number of the given keys already present in reward_events. */
  countEvents: (keys: string[]) => Promise<number>;
  /** Inserts missing user_tasks ids; returns how many were added. */
  insertTaskIds: (ids: string[]) => Promise<number>;
  unitIds: (base: string, units: number) => string[];
  currentPoints: () => Promise<number>;
};

export type DailyBatchResult = {
  points: number;
  granted: number;
  allRecorded: boolean;
  unitsAdded: number;
};

export async function runDailyBatch(
  game: DailyGame,
  day: string,
  indices: number[],
  deps: DailyBatchDeps,
): Promise<DailyBatchResult> {
  const cfg = DAILY_GAMES[game];
  let points: number | null = null;
  let granted = 0;
  for (const i of indices) {
    const r = await deps.claimOnce(rewardKey(game, day, i), cfg.points);
    points = r.points;
    if (r.granted) granted++;
  }
  // Task units only when ALL of today's rewards are actually recorded.
  const all = Array.from({ length: cfg.count }, (_, i) => rewardKey(game, day, i));
  const allRecorded = (await deps.countEvents(all)) === all.length;
  const unitsAdded = allRecorded
    ? await deps.insertTaskIds(deps.unitIds(`${cfg.unitBase}-${day}`, TASK_UNITS[cfg.unitKind]))
    : 0;
  return { points: points ?? (await deps.currentPoints()), granted, allRecorded, unitsAdded };
}
