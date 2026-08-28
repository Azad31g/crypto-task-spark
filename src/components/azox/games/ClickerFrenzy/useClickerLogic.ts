import { useCallback, useEffect, useRef, useState } from "react";
import { useAzox } from "@/components/azox/app-provider";
import { haptic } from "@/lib/telegram";

export const ROUND_MS = 30 * 1000;
export const POINTS_PER_TAP = 8;
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

const K = {
  lastPlayed: "clickerFrenzy_lastPlayed",
  bestTaps: "clickerFrenzy_bestTaps",
  bestPoints: "clickerFrenzy_bestPoints",
  lastTaps: "clickerFrenzy_lastTaps",
  lastPoints: "clickerFrenzy_lastPoints",
} as const;

function read(key: string): number {
  if (typeof window === "undefined") return 0;
  const n = Number(window.localStorage.getItem(key));
  return Number.isFinite(n) ? n : 0;
}

export function formatHMS(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function formatMS(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type FloatingPoint = { id: number; x: number; y: number; value: number };

export type ClickerPhase = "loading" | "ready" | "playing" | "over" | "cooldown";

export function useClickerFrenzy() {
  const { addPoints } = useAzox();
  const [hydrated, setHydrated] = useState(false);
  const [lastPlayed, setLastPlayed] = useState(0);
  const [best, setBest] = useState({ taps: 0, points: 0 });
  const [last, setLast] = useState({ taps: 0, points: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [taps, setTaps] = useState(0);
  const [over, setOver] = useState(false);
  const [newRecord, setNewRecord] = useState(false);
  const [floating, setFloating] = useState<FloatingPoint[]>([]);
  const [flash, setFlash] = useState(0);
  const floatId = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    setLastPlayed(read(K.lastPlayed));
    setBest({ taps: read(K.bestTaps), points: read(K.bestPoints) });
    setLast({ taps: read(K.lastTaps), points: read(K.lastPoints) });
    setHydrated(true);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const points = taps * POINTS_PER_TAP;
  const elapsed = startedAt === null ? 0 : now - startedAt;
  const timeLeft = startedAt === null ? ROUND_MS : Math.max(0, ROUND_MS - elapsed);
  const cooldownLeft = Math.max(0, lastPlayed + COOLDOWN_MS - now);
  const locked = cooldownLeft > 0;

  const endRound = useCallback(
    (finalTaps: number) => {
      if (finished.current) return;
      finished.current = true;
      const finalPoints = finalTaps * POINTS_PER_TAP;
      const t = Date.now();
      const beat = finalPoints > read(K.bestPoints);
      window.localStorage.setItem(K.lastPlayed, String(t));
      window.localStorage.setItem(K.lastTaps, String(finalTaps));
      window.localStorage.setItem(K.lastPoints, String(finalPoints));
      if (finalTaps > read(K.bestTaps))
        window.localStorage.setItem(K.bestTaps, String(finalTaps));
      if (beat) window.localStorage.setItem(K.bestPoints, String(finalPoints));
      setLastPlayed(t);
      setLast({ taps: finalTaps, points: finalPoints });
      setBest({ taps: read(K.bestTaps), points: read(K.bestPoints) });
      setNewRecord(beat && finalPoints > 0);
      setOver(true);
      if (finalPoints > 0) addPoints(finalPoints);
      haptic("medium");
    },
    [addPoints],
  );

  // Auto-finish when the timer reaches zero.
  useEffect(() => {
    if (startedAt === null || over) return;
    if (timeLeft > 0) return;
    endRound(taps);
  }, [startedAt, over, timeLeft, taps, endRound]);

  const addFloating = useCallback((x: number, y: number, value: number) => {
    const id = ++floatId.current;
    setFloating((f) => [...f.slice(-14), { id, x, y, value }]);
    window.setTimeout(() => {
      setFloating((f) => f.filter((p) => p.id !== id));
    }, 620);
  }, []);

  const handleTap = useCallback(
    (x: number, y: number) => {
      if (locked || over) return;
      if (startedAt === null) {
        finished.current = false;
        setTaps(1);
        setStartedAt(Date.now());
        addFloating(x, y, POINTS_PER_TAP);
        setFlash(Date.now());
        haptic();
        return;
      }
      if (Date.now() - startedAt >= ROUND_MS) return;
      setTaps((t) => t + 1);
      addFloating(x, y, POINTS_PER_TAP);
      setFlash(Date.now());
      haptic();
    },
    [locked, over, startedAt, addFloating],
  );

  const phase: ClickerPhase = !hydrated
    ? "loading"
    : over
      ? "over"
      : startedAt !== null
        ? "playing"
        : locked
          ? "cooldown"
          : "ready";

  return {
    phase,
    taps,
    points,
    timeLeft,
    cooldownLeft,
    best,
    last,
    newRecord,
    floating,
    flash,
    urgent: phase === "playing" && timeLeft <= 5000,
    handleTap,
  };
}
