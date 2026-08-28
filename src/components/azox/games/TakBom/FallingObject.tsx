import { useEffect, useRef } from "react";

import type { FallingObj } from "./types";

const PAD = 16;

export function FallingObject({
  obj,
  onTap,
  onDone,
}: {
  obj: FallingObj;
  onTap: (obj: FallingObj) => void;
  onDone: (id: number) => void;
}) {
  const elRef = useRef<HTMLButtonElement>(null);
  const yRef = useRef(-obj.size - PAD * 2);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    // reset per-mount state (StrictMode remounts effects)
    doneRef.current = false;
    lastTimeRef.current = 0;
    yRef.current = -obj.size - PAD * 2;

    // Calculate speed inside effect so window.innerHeight is correct
    const screenHeight = window.innerHeight || 800;
    const speed = (screenHeight / obj.duration) * 1.35;

    const tick = (now: number) => {
      if (doneRef.current) return;

      const dt = lastTimeRef.current
        ? (now - lastTimeRef.current) / 1000
        : 0.016;
      lastTimeRef.current = now;

      yRef.current += speed * dt;
      el.style.transform = `translate3d(0, ${yRef.current}px, 0)`;

      if (yRef.current > screenHeight + obj.size + PAD * 2) {
        doneRef.current = true;
        onDone(obj.id);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, []); // empty deps — runs once on mount only

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    onTap(obj);
  };

  return (
    <button
      ref={elRef}
      type="button"
      onPointerDown={handlePointerDown}
      aria-label={obj.kind === "bomb" ? "Bomb" : "Star"}
      style={{
        position: "absolute",
        left: `${obj.x}%`,
        top: 0,
        width: obj.size + PAD * 2,
        height: obj.size + PAD * 2,
        padding: PAD,
        marginLeft: -(obj.size / 2 + PAD),
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        pointerEvents: "all",
        background: "none",
        border: "none",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        zIndex: 10,
        overflow: "visible",
        willChange: "transform",
        transform: `translate3d(0, -150px, 0)`,
      }}
    >
      {obj.kind === "star" ? (
        <span style={{ width: "100%", height: "100%", pointerEvents: "none",
          filter: "drop-shadow(0 0 2px rgba(74,158,26,0.5))" }}>
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <g stroke="#2E8B10" strokeWidth="12" strokeLinecap="round" opacity="0.7">
              <line x1="50" y1="8" x2="50" y2="92" />
              <line x1="8" y1="50" x2="92" y2="50" />
              <line x1="20" y1="20" x2="80" y2="80" />
              <line x1="80" y1="20" x2="20" y2="80" />
            </g>
            <g stroke="#4a9e1a" strokeWidth="8" strokeLinecap="round">
              <line x1="50" y1="8" x2="50" y2="92" />
              <line x1="8" y1="50" x2="92" y2="50" />
              <line x1="20" y1="20" x2="80" y2="80" />
              <line x1="80" y1="20" x2="20" y2="80" />
            </g>
            <circle cx="50" cy="50" r="10" fill="#4a9e1a" />
          </svg>
        </span>
      ) : (
        <span style={{ width: "100%", height: "100%", pointerEvents: "none",
          display: "grid", placeItems: "center", borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #fde047, #ca8a04)",
          boxShadow: "0 0 14px #facc15, 0 0 28px rgba(250,204,21,0.6)",
          border: "2px solid #fef08a",
          fontSize: `${Math.round(obj.size * 0.5)}px` }}>
          💣
        </span>
      )}
    </button>
  );
}
