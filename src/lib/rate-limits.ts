// SECURITY limits enforced server-side (atomically, inside the DB RPCs).
// Real top scores today: shoot 420, snake 180, takbom 24 — these caps leave
// plenty of headroom. Adjust only in this one file.
import { TAP_BATCH_INTERVAL_MS, TAP_BATCH_SERVER_GRACE_MS } from "./tap-batch";

/** Minimum seconds between two accepted Main Tap batches (= 570). */
export const TAP_MIN_INTERVAL_SECONDS = (TAP_BATCH_INTERVAL_MS - TAP_BATCH_SERVER_GRACE_MS) / 1000;
/** Minimum seconds between two paid arcade game scores. */
export const GAME_SCORE_MIN_INTERVAL_SECONDS = 10;
/** Largest single arcade game score the server will pay. */
export const GAME_SCORE_MAX_PER_CLAIM = 10_000;
/** Max arcade-game points one user can earn per rolling hour. */
export const GAME_SCORE_MAX_POINTS_PER_HOUR = 100_000;
