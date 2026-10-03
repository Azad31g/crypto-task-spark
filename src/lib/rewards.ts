// Pure data: every reward value the server is allowed to pay.
// Values are copied from the existing game/task constants — do not change.
// Safe to import from both server and browser code (no images, no window).
import { SOCIAL_TASKS } from "./social-tasks";
import { BOX_REWARD, BOXES_PER_DAY } from "./azox-box-schedule";
import { RANKS } from "./ranks";

/** Social task id -> points, taken from SOCIAL_TASKS. */
export const SOCIAL_TASK_POINTS: Record<string, number> = Object.fromEntries(
  SOCIAL_TASKS.flatMap((g) => g.tasks.map((t) => [t.id, t.points] as const)),
);

export const DAILY_GIFT_POINTS = 200;

export const GLOBAL_BUTTON_REWARD = 400;
export const GLOBAL_BUTTON_SLOT_MS = 3 * 60 * 60 * 1000;
export const GLOBAL_BUTTON_ACTIVE_MS = 20 * 1000;
export const GLOBAL_BUTTON_MAX_WINNERS = 35000;

export { BOX_REWARD, BOXES_PER_DAY };

export const WORD_POINTS = 80;
export const WORDS_PER_DAY = 5;

export const QUESTION_POINTS = 100;
/** Number of questions in the QuestionDay set (all must be answered correctly). */
export const QUESTIONS_PER_DAY = 6;
/** Upper bound on question index accepted per day (sanity cap only). */
export const MAX_QUESTIONS_PER_DAY = 20;

export const CLICKER_POINTS_PER_TAP = 8;
export const CLICKER_ROUND_MS = 30 * 1000;
export const CLICKER_COOLDOWN_MS = 4 * 60 * 60 * 1000;
/** Sanity cap: ~15 taps/second for a 30 s round. */
export const CLICKER_MAX_TAPS = 450;

/** Max fingers counted for one tap event. */
export const TAP_MAX_FINGERS = 10;

/** Arcade games whose score is paid out as points (browser-reported). */
export const SCORE_GAMES = ["snake", "takbom", "shoot"] as const;
export type ScoreGame = (typeof SCORE_GAMES)[number];
/** Sanity cap on a single browser-reported game score. */
export const MAX_GAME_SCORE = 100_000;

/** Task units awarded for game achievements (unchanged values). */
export const TASK_UNITS = {
  word_complete: 2,
  box_open: 1,
  question_complete: 2,
  daily_streak: 3,
  world_record: 10,
  global_button: 1,
} as const;

/** Rank thresholds passed to grant_points / claim_reward. */
export const RANK_THRESHOLDS_PAYLOAD = RANKS.map(({ key, threshold }) => ({
  key,
  threshold,
}));

/**
 * What the browser may ask for. The browser never sends an amount for
 * fixed rewards — the server looks the value up above.
 */
export type RewardClaim =
  | { type: "tap"; fingers: number }
  | { type: "social_task"; taskId: string }
  | { type: "daily_gift" }
  | { type: "box_open"; session: number }
  | { type: "word_correct"; index: number }
  | { type: "question_correct"; index: number }
  | { type: "clicker_round"; taps: number }
  | { type: "game_score"; gameId: ScoreGame; score: number }
  | { type: "global_button" }
  /** Local display only — nothing is written (unreachable legacy screens). */
  | { type: "none" };

export type TaskUnitKind = "word_complete" | "box_open" | "question_complete" | "daily_streak";
