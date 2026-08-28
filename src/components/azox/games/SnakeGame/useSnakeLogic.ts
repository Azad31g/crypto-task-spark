import { useCallback, useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/lib/points";
import {
  GRID,
  SNAKE_BEST_KEY,
  type Direction,
  type GameState,
  type Item,
  type ItemKind,
  type Position,
} from "./types";

const START_SPEED = 200;
const MIN_SPEED = 100;
const MAX_ROCKS = 8;

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DELTA: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const key = (p: Position) => `${p.x},${p.y}`;

function initialSnake(): Position[] {
  const c = Math.floor(GRID / 2);
  return [
    { x: c, y: c },
    { x: c - 1, y: c },
    { x: c - 2, y: c },
  ];
}

let idSeq = 1;

function randomFreeCell(taken: Set<string>): Position | null {
  const free: Position[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (!free.length) return null;
  return free[Math.floor(Math.random() * free.length)]!;
}

function rollKind(): ItemKind {
  const r = Math.random();
  if (r < 0.62) return "coin";
  if (r < 0.82) return "diamond";
  if (r < 0.92) return "heart";
  return "lightning";
}

function makeItems(snake: Position[], rocks: Item[]): Item[] {
  const taken = new Set(snake.map(key));
  rocks.forEach((r) => taken.add(key(r.pos)));
  const items: Item[] = [];
  for (let i = 0; i < 6; i++) {
    const pos = randomFreeCell(taken);
    if (!pos) break;
    taken.add(key(pos));
    items.push({ id: idSeq++, kind: rollKind(), pos });
  }
  return items;
}

function makeRocks(snake: Position[], count: number, existing: Item[]): Item[] {
  const taken = new Set(snake.map(key));
  existing.forEach((r) => taken.add(key(r.pos)));
  // keep a safe corridor around the snake head row
  const rocks: Item[] = [];
  for (let i = 0; i < count; i++) {
    const pos = randomFreeCell(taken);
    if (!pos) break;
    taken.add(key(pos));
    rocks.push({ id: idSeq++, kind: "rock", pos });
  }
  return rocks;
}

export function useSnakeLogic(onGameOver?: (score: number) => void) {
  const [state, setState] = useState<GameState>("start");
  const [snake, setSnake] = useState<Position[]>(initialSnake);
  const [dir, setDir] = useState<Direction>("right");
  const [items, setItems] = useState<Item[]>([]);
  const [rocks, setRocks] = useState<Item[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(1);
  const [eaten, setEaten] = useState(0);
  const [boostUntil, setBoostUntil] = useState(0);
  const [newRecord, setNewRecord] = useState(false);

  const dirRef = useRef<Direction>("right");
  const queued = useRef<Direction | null>(null);
  const growRef = useRef(0);
  const overRef = useRef(onGameOver);
  overRef.current = onGameOver;
  const rocksRef = useRef<Item[]>([]);
  rocksRef.current = rocks;


  useEffect(() => {
    setBest(readStorage<number>(SNAKE_BEST_KEY, 0));
  }, []);

  const setDirection = useCallback((next: Direction) => {
    if (OPPOSITE[dirRef.current] === next || dirRef.current === next) return;
    queued.current = next;
    setDir(next);
  }, []);

  // keep the ref in sync with direction state for the game loop
  useEffect(() => {
    if (queued.current === null) dirRef.current = dir;
  }, [dir]);

  const reset = useCallback(() => {
    const s = initialSnake();
    const r = makeRocks(s, 5, []);
    dirRef.current = "right";
    queued.current = null;
    growRef.current = 0;
    setSnake(s);
    setDir("right");
    setRocks(r);
    setItems(makeItems(s, r));
    setScore(0);
    setLives(1);
    setEaten(0);
    setBoostUntil(0);
    setNewRecord(false);
  }, []);

  const start = useCallback(() => {
    reset();
    setState("playing");
  }, [reset]);

  const pause = useCallback(() => {
    setState((s) => (s === "playing" ? "paused" : s));
  }, []);
  const resume = useCallback(() => {
    setState((s) => (s === "paused" ? "playing" : s));
  }, []);

  const speed = Math.max(
    MIN_SPEED,
    (START_SPEED - Math.floor(eaten / 5) * 10) *
      (Date.now() < boostUntil ? 0.75 : 1),
  );

  // periodic new rocks: 1 every 15s, capped at MAX_ROCKS
  useEffect(() => {
    if (state !== "playing") return;
    const t = setInterval(() => {
      setRocks((prev) =>
        prev.length >= MAX_ROCKS ? prev : [...prev, ...makeRocks(snake, 1, prev)],
      );
    }, 15000);
    return () => clearInterval(t);
  }, [state, snake]);

  const endGame = useCallback(
    (finalScore: number) => {
      setState("over");
      const prevBest = readStorage<number>(SNAKE_BEST_KEY, 0);
      if (finalScore > prevBest) {
        writeStorage(SNAKE_BEST_KEY, finalScore);
        setBest(finalScore);
        setNewRecord(true);
      }
      overRef.current?.(finalScore);
    },
    [],
  );

  useEffect(() => {
    if (state !== "playing") return;
    const tick = setInterval(() => {
      if (queued.current) {
        dirRef.current = queued.current;
        queued.current = null;
        setDir(dirRef.current);
      }
      setSnake((prev) => {
        const head = prev[0]!;
        const d = DELTA[dirRef.current];
        const next: Position = { x: head.x + d.x, y: head.y + d.y };

        const hitWall =
          next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID;
        const body = prev.slice(0, prev.length - 1);
        const hitSelf = body.some((p) => p.x === next.x && p.y === next.y);
        const hitRock = rocksRef.current.some(
          (r) => r.pos.x === next.x && r.pos.y === next.y,
        );

        const fatal = hitWall || hitSelf || hitRock;

        if (fatal) {
          let survived = false;
          setLives((l) => {
            if (l > 1) {
              survived = true;
              return l - 1;
            }
            return l;
          });
          if (!survived) {
            setScore((s) => {
              endGame(s);
              return s;
            });
            return prev;
          }
          // shield consumed: bounce back, keep position
          if (hitRock) {
            setRocks((rs) =>
              rs.filter((r) => !(r.pos.x === next.x && r.pos.y === next.y)),
            );
          } else {
            dirRef.current = OPPOSITE[dirRef.current];
            setDir(dirRef.current);
          }
          return prev;
        }

        // collect
        setItems((its) => {
          const hitIdx = its.findIndex(
            (i) => i.pos.x === next.x && i.pos.y === next.y,
          );
          if (hitIdx === -1) return its;
          const hit = its[hitIdx]!;
          if (hit.kind === "coin") {
            setScore((s) => s + 5);
            growRef.current += 1;
            setEaten((e) => e + 1);
          } else if (hit.kind === "diamond") {
            setScore((s) => s + 15);
            growRef.current += 3;
            setEaten((e) => e + 1);
          } else if (hit.kind === "heart") {
            setLives((l) => l + 1);
          } else {
            setBoostUntil(Date.now() + 5000);
          }
          const taken = new Set(prev.map(key));
          taken.add(key(next));
          its.forEach((i, n) => {
            if (n !== hitIdx) taken.add(key(i.pos));
          });
          const spot = randomFreeCell(taken);
          const rest = its.filter((_, n) => n !== hitIdx);
          return spot
            ? [...rest, { id: idSeq++, kind: rollKind(), pos: spot }]
            : rest;
        });

        const grown = [next, ...prev];
        if (growRef.current > 0) {
          growRef.current -= 1;
          return grown;
        }
        grown.pop();
        return grown;
      });
    }, speed);
    return () => clearInterval(tick);
  }, [state, speed, endGame]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const map: Record<string, Direction> = {
        arrowup: "up",
        arrowdown: "down",
        arrowleft: "left",
        arrowright: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const next = map[k];
      if (next) {
        e.preventDefault();
        if (state === "start" || state === "over") start();
        else setDirection(next);
        return;
      }
      if (k === " " || k === "enter") {
        e.preventDefault();
        if (state === "start" || state === "over") start();
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [state, start, setDirection]);

  return {
    state,
    snake,
    dir,
    items,
    rocks,
    score,
    best,
    lives,
    newRecord,
    boosted: Date.now() < boostUntil,
    setDirection,
    start,
    pause,
    resume,
  };
}
