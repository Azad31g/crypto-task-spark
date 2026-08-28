import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pause, Play, Rocket } from "lucide-react";

export function fmtTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function GameHeader({
  score,
  best,
  timeMs,
  paused,
  onTogglePause,
}: {
  score: number;
  best: number;
  timeMs: number;
  paused: boolean;
  onTogglePause: () => void;
}) {
  return (
    <div className="px-3 pt-3">
      <div className="flex items-center gap-2">
        <Link
          to="/gaming"
          aria-label="Back to gaming hub"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-neutral-900/80 backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-neutral-900/80">
          <Rocket className="h-5 w-5 text-emerald-400" aria-hidden="true" />
        </div>
        <div className="text-[17px] font-semibold tracking-tight">AZOX Shooter</div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-neutral-900/70 px-3 py-2">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400">
            SCORE
          </div>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-orange-400">
            {score.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-neutral-900/70 px-3 py-2">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400">
            BEST SCORE
          </div>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-yellow-400">
            {best.toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-neutral-900/70 px-3 py-2">
          <div className="flex-1">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400">
              TIME
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums">
              {fmtTime(timeMs)}
            </div>
          </div>
          <button
            type="button"
            onClick={onTogglePause}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-neutral-800"
            aria-label={paused ? "Resume" : "Pause"}
          >
            {paused ? (
              <Play className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Pause className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
