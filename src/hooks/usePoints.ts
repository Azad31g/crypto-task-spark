import { useCallback, useEffect, useMemo, useState } from "react";
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
  addPointsRemote,
  currentTelegramId,
  fetchUser,
} from "@/lib/azox-backend";

type PointsState = { points: number; taps: number; globalWins: number };

const DEFAULT: PointsState = { points: 0, taps: 0, globalWins: 0 };

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
      setState((prev) => ({ ...prev, points: row.points }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(STORAGE_KEYS.points, state);
  }, [state, hydrated]);

  const addPoints = useCallback((amount: number) => {
    // Optimistic local update, then reconcile with the server total.
    setState((prev) => ({
      ...prev,
      points: Math.max(0, prev.points + amount),
      taps: amount > 0 ? prev.taps + 1 : prev.taps,
    }));
    void addPointsRemote(amount).then((total) => {
      if (typeof total === "number") {
        setState((prev) => ({ ...prev, points: total }));
      }
    });
  }, []);

  const addGlobalWin = useCallback(() => {
    setState((prev) => ({ ...prev, globalWins: prev.globalWins + 1 }));
  }, []);

  const reset = useCallback(() => setState(DEFAULT), []);

  const rank = useMemo(() => rankForPoints(state.points), [state.points]);

  /** Points earned for a tap with `fingers` fingers at the current rank. */
  const tap = useCallback(
    (fingers = 1) => {
      const gained = Math.max(1, fingers) * rank.pointsPerFinger;
      addPoints(gained);
      return gained;
    },
    [addPoints, rank.pointsPerFinger],
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
