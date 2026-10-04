import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  STORAGE_KEYS,
  levelForPoints,
  nextRank,
  progressToNextRank,
  rankForPoints,
  readStorage,
  writeStorage,
} from "@/lib/points";
import {
  claimRewardRemote,
  currentTelegramId,
  fetchUser,
  submitTapBatch,
} from "@/lib/azox-backend";
import {
  TAP_BATCH_INTERVAL_MS,
  TAP_BATCH_STORAGE_KEY,
  addTaps,
  confirmBatch,
  parseTapState,
  takeBatch,
  takeInflightOnly,
  type TapBatchState,
} from "@/lib/tap-batch";
import type { RewardClaim } from "@/lib/rewards";

type PointsState = { points: number; taps: number; globalWins: number };

const DEFAULT: PointsState = { points: 0, taps: 0, globalWins: 0 };

const readTaps = (): TapBatchState => parseTapState(readStorage(TAP_BATCH_STORAGE_KEY, null));
const writeTaps = (s: TapBatchState) => writeStorage(TAP_BATCH_STORAGE_KEY, s);

/** One flush at a time per client (module-level guard). */
let tapFlushInFlight = false;

/**
 * Sends the in-flight batch (or cuts a new one from pending). The batch is
 * only cleared after the server confirms it; failures keep it for retry
 * with the same id, so a lost response can never be paid twice.
 */
async function flushTaps(inflightOnly = false): Promise<number | null> {
  if (tapFlushInFlight) return null;
  let batch;
  if (inflightOnly) {
    batch = takeInflightOnly(readTaps());
  } else {
    const r = takeBatch(readTaps());
    batch = r.batch;
    if (batch) writeTaps(r.state);
  }
  if (!batch) return null;
  tapFlushInFlight = true;
  try {
    const total = await submitTapBatch(batch.id, batch.units);
    if (total === null) return null;
    writeTaps(confirmBatch(readTaps(), batch.id));
    return total;
  } finally {
    tapFlushInFlight = false;
  }
}

export function usePoints() {
  const [state, setState] = useState<PointsState>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStorage<Partial<PointsState>>(STORAGE_KEYS.points, {});
    setState({
      points: typeof stored.points === "number" ? stored.points : 0,
      taps: typeof stored.taps === "number" ? stored.taps : 0,
      globalWins: typeof stored.globalWins === "number" ? stored.globalWins : 0,
    });
    setHydrated(true);

    // Inside Telegram the server is the source of truth.
    const telegramId = currentTelegramId();
    if (!telegramId) return;
    let cancelled = false;
    void fetchUser(telegramId).then((row) => {
      if (cancelled || !row || typeof row.points !== "number") return;
      const t = readTaps();
      const unsent = t.pending + (t.inflight?.units ?? 0);
      setState((prev) => ({
        ...prev,
        points: row.points + unsent * rankForPoints(row.points).pointsPerFinger,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(STORAGE_KEYS.points, state);
  }, [state, hydrated]);

  const addPoints = useCallback((amount: number, claim: RewardClaim) => {
    // Optimistic local update, then reconcile with the server total.
    setState((prev) => ({
      ...prev,
      points: Math.max(0, prev.points + amount),
      taps: amount > 0 ? prev.taps + 1 : prev.taps,
    }));
    if (amount <= 0 && claim.type !== "daily_batch") return;
    void claimRewardRemote(claim).then((total) => {
      if (typeof total === "number") {
        setState((prev) => ({ ...prev, points: total }));
      }
    });
  }, []);

  const addGlobalWin = useCallback(() => {
    setState((prev) => ({ ...prev, globalWins: prev.globalWins + 1 }));
  }, []);

  const pprRef = useRef(1);

  // Main Tap batching: one request at most every 10 minutes, plus a
  // best-effort retry of an in-flight batch when the page is hidden or left.
  useEffect(() => {
    if (!currentTelegramId()) return;
    const run = (inflightOnly = false) => {
      void flushTaps(inflightOnly).then((total) => {
        if (typeof total !== "number") return;
        // Keep unsent local taps visible on top of the server total.
        const t = readTaps();
        const unsent = t.pending + (t.inflight?.units ?? 0);
        setState((prev) => ({ ...prev, points: total + unsent * pprRef.current }));
      });
    };
    const timer = window.setInterval(() => run(), TAP_BATCH_INTERVAL_MS);
    // Lifecycle: only retry an already in-flight batch; fresh pending taps
    // wait for the regular 10-minute timer.
    const onHide = () => {
      if (document.visibilityState === "hidden") run(true);
    };
    const onPageHide = () => run(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  const reset = useCallback(() => setState(DEFAULT), []);

  const rank = useMemo(() => rankForPoints(state.points), [state.points]);
  pprRef.current = rank.pointsPerFinger;

  /** Points earned for a tap with `fingers` fingers at the current rank. */
  const tap = useCallback(
    (fingers = 1) => {
      const units = Math.min(10, Math.max(1, Math.floor(fingers)));
      const gained = Math.max(1, fingers) * rank.pointsPerFinger;
      // Local only; the server pays via the periodic tap_batch.
      setState((prev) => ({ ...prev, points: prev.points + gained, taps: prev.taps + 1 }));
      writeTaps(addTaps(readTaps(), units));
      return gained;
    },
    [rank.pointsPerFinger],
  );

  return {
    points: state.points,
    taps: state.taps,
    globalWins: state.globalWins,
    rank,
    nextRank: nextRank(state.points),
    level: levelForPoints(state.points),
    progress: progressToNextRank(state.points),
    pointsPerFinger: rank.pointsPerFinger,
    hydrated,
    addPoints,
    addGlobalWin,
    tap,
    reset,
  };
}
