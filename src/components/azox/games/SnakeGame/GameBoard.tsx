import { useRef } from "react";
import { GRID, type Direction, type GameState, type Item, type Position } from "./types";

const ITEM_STYLE: Record<Item["kind"], React.CSSProperties> = {
  coin: {
    background: "radial-gradient(circle at 35% 30%, #fde68a, #fbbf24 70%)",
    borderRadius: "9999px",
    boxShadow: "0 0 8px rgba(251,191,36,0.6)",
  },
  diamond: {
    background: "linear-gradient(135deg, #93c5fd, #60a5fa)",
    borderRadius: "4px",
    transform: "rotate(45deg)",
    boxShadow: "0 0 8px rgba(96,165,250,0.6)",
  },
  heart: {
    background: "radial-gradient(circle at 35% 30%, #fda4af, #f43f5e 70%)",
    borderRadius: "9999px",
    boxShadow: "0 0 8px rgba(244,63,94,0.55)",
  },
  lightning: {
    background: "linear-gradient(135deg, #d9f99d, #a3e635)",
    borderRadius: "3px",
    transform: "rotate(20deg)",
    boxShadow: "0 0 8px rgba(163,230,53,0.6)",
  },
  rock: {
    background: "linear-gradient(150deg, #6b7280, #374151)",
    borderRadius: "5px",
  },
};

export function GameBoard({
  snake,
  items,
  rocks,
  gameState,
  onStart,
  onSwipe,
  children,
}: {
  snake: Position[];
  items: Item[];
  rocks: Item[];
  gameState: GameState;
  onStart: () => void;
  onSwipe: (d: Direction) => void;
  children?: React.ReactNode;
}) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const cell = 100 / GRID;

  const handleStart = (x: number, y: number) => {
    if (gameState !== "playing") {
      onStart();
      return;
    }
    startRef.current = { x, y };
  };
  const handleEnd = (x: number, y: number) => {
    const s = startRef.current;
    startRef.current = null;
    if (!s) return;
    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 30) onSwipe("right");
      else if (dx < -30) onSwipe("left");
    } else {
      if (dy > 30) onSwipe("down");
      else if (dy < -30) onSwipe("up");
    }
  };

  return (
    <div className="flex w-full justify-center px-4">
      <div
        onPointerDown={(e) => handleStart(e.clientX, e.clientY)}
        onPointerUp={(e) => handleEnd(e.clientX, e.clientY)}
        onPointerCancel={() => (startRef.current = null)}
        onTouchStart={(e) => {
          e.preventDefault();
          if (gameState !== "playing") {
            onStart();
            return;
          }
          const t = e.touches[0];
          if (t) handleStart(t.clientX, t.clientY);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          const t = e.changedTouches[0];
          if (t) handleEnd(t.clientX, t.clientY);
        }}
        className="relative aspect-square w-[min(85vw,480px)] overflow-hidden rounded-2xl border-2 border-primary bg-[#0d0d0d] md:w-[min(60vw,500px)] lg:w-[480px]"
        style={{
          touchAction: "none",
          boxShadow:
            "0 0 24px rgba(34,197,94,0.45), inset 0 0 40px rgba(0,0,0,0.9)",
          backgroundImage:
            "linear-gradient(#1a1a1a 1px, transparent 1px), linear-gradient(90deg, #1a1a1a 1px, transparent 1px)",
          backgroundSize: `${cell}% ${cell}%`,
        }}
      >
        {[...rocks, ...items].map((it) => (
          <div
            key={`${it.kind}-${it.id}`}
            className="absolute grid place-items-center"
            style={{
              left: `${it.pos.x * cell}%`,
              top: `${it.pos.y * cell}%`,
              width: `${cell}%`,
              height: `${cell}%`,
              pointerEvents: "none",
            }}
          >
            <span
              aria-hidden="true"
              className="block size-[70%]"
              style={{
                ...ITEM_STYLE[it.kind],
                ...(it.kind === "rock"
                  ? { animation: "snake-rock-flash 0.5s ease-out" }
                  : null),
              }}
            />
          </div>
        ))}

        {snake.map((seg, i) => {
          const isHead = i === 0;
          const isTail = i === snake.length - 1 && snake.length > 1;
          return (
            <div
              key={`${seg.x}-${seg.y}-${i}`}
              className="absolute grid place-items-center"
              style={{
                left: `${seg.x * cell}%`,
                top: `${seg.y * cell}%`,
                width: `${cell}%`,
                height: `${cell}%`,
                zIndex: snake.length - i,
                pointerEvents: "none",
              }}
            >
              <span
                aria-hidden="true"
                className="relative block"
                style={{
                  width: isHead ? "100%" : isTail ? "70%" : "84%",
                  height: isHead ? "100%" : isTail ? "70%" : "84%",
                  borderRadius: isHead ? 6 : 4,
                  background: isHead
                    ? "#22c55e"
                    : isTail
                      ? "#15803d"
                      : "#16a34a",
                  boxShadow: isHead
                    ? "0 0 10px rgba(34,197,94,0.7)"
                    : undefined,
                }}
              >
                {isHead ? (
                  <>
                    <span className="absolute left-[22%] top-[26%] block size-[16%] rounded-full bg-white" />
                    <span className="absolute right-[22%] top-[26%] block size-[16%] rounded-full bg-white" />
                  </>
                ) : null}
              </span>
            </div>
          );
        })}

        {children}
      </div>
    </div>
  );
}
