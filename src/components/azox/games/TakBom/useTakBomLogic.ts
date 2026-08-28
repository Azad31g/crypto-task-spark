import { useCallback, useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/lib/points";
import {
  GAME_SECONDS,
  STAR_POINTS,
  TAKBOM_BEST_KEY,
  type FallingObj,
  type TakBomState,
} from "./types";

const MAX_OBJECTS = 35;
const SPAWN_MS = 400;

let idSeq = 1;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function useTakBomLogic(onGameOver?: (score: number) => void) {
  const [state, setState] = useState<TakBomState>("start");
  const [objects, setObjects] = useState<FallingObj[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [boomAt, setBoomAt] = useState(0);
  const [newRecord, setNewRecord] = useState(false);

  const overRef = useRef(onGameOver);
  overRef.current = onGameOver;
  const lastBombRef = useRef(0);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  useEffect(() => {
    setBest(readStorage<number>(TAKBOM_BEST_KEY, 0));
  }, []);

  const endGame = useCallback(() => {
    const final = scoreRef.current;
    setState("over");
    setObjects([]);
    const prev = readStorage<number>(TAKBOM_BEST_KEY, 0);
    if (final > prev) {
      writeStorage(TAKBOM_BEST_KEY, final);
      setBest(final);
      setNewRecord(true);
    }
    overRef.current?.(final);
  }, []);

  const start = useCallback(() => {
    idSeq = 1;
    lastBombRef.current = Date.now();
    setObjects([]);
    setScore(0);
    setTimeLeft(GAME_SECONDS);
    setNewRecord(false);
    setBoomAt(0);
    setState("playing");
  }, []);

  const pause = useCallback(
    () => setState((s) => (s === "playing" ? "paused" : s)),
    [],
  );
  const resume = useCallback(
    () => setState((s) => (s === "paused" ? "playing" : s)),
    [],
  );

  // countdown
  useEffect(() => {
    if (state !== "playing") return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state, endGame]);

  // speed tier grows every 15 seconds
  const elapsed = GAME_SECONDS - timeLeft;
  const tier = Math.floor(elapsed / 15);

  // spawning
  useEffect(() => {
    if (state !== "playing") return;
    const t = setInterval(() => {
      setObjects((prev) => {
        if (prev.length >= MAX_OBJECTS) return prev;
        const now = Date.now();
        const bombDue = now - lastBombRef.current > rand(2000, 3000);
        if (bombDue) lastBombRef.current = now;
        const maxFall = Math.max(4.5, 7 - tier * 0.5);
        const make = (kind: "star" | "bomb"): FallingObj => ({
          id: idSeq++,
          kind,
          x: rand(5, 95),
          duration: rand(4, maxFall),
          size: Math.round(rand(34, 62)),
          spawnedAt: now,
        });
        const next = [...prev, make(bombDue ? "bomb" : "star")];
        // sometimes spawn a second object for higher density
        if (Math.random() < 0.6 && next.length < MAX_OBJECTS) {
          const secondKind = Math.random() < 0.35 ? "bomb" : "star";
          next.push(make(secondKind));
        }
        return next;
      });
    }, SPAWN_MS);
    return () => clearInterval(t);
  }, [state, tier]);

  const removeObject = useCallback((id: number) => {
    setObjects((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const tapObject = useCallback(
    (obj: FallingObj) => {
      if (state !== "playing") return;
      // Remove immediately — do not wait for animation
      setObjects((prev) => prev.filter((o) => o.id !== obj.id));
      if (obj.kind === "bomb") {
        setScore(0);
        setBoomAt(Date.now());
      } else {
        setScore((s) => s + STAR_POINTS);
      }
    },
    [state],
  );

  return {
    state,
    objects,
    score,
    best,
    timeLeft,
    newRecord,
    boomAt,
    start,
    pause,
    resume,
    tapObject,
    removeObject,
  };
}
