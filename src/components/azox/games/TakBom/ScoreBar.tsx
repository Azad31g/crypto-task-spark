import { Clock } from "lucide-react";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function ScoreBar({
  timeLeft,
  score,
  best,
}: {
  timeLeft: number;
  score: number;
  best: number;
}) {
  const mm = Math.floor(timeLeft / 60);
  const ss = timeLeft % 60;

  return (
    <div className="grid grid-cols-3 gap-3 px-4 pb-3">
      <div className="rounded-2xl border border-primary/20 bg-white/[0.04] px-3 py-2 text-center">
        <div className="flex items-center justify-center gap-1.5 text-primary">
          <Clock className="h-4 w-4" />
          <span className="text-xl font-extrabold tabular-nums">
            {pad(mm)}:{pad(ss)}
          </span>
        </div>
        <div className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
          TIME
        </div>
      </div>
      <div className="rounded-2xl border border-primary/20 bg-white/[0.04] px-3 py-2 text-center">
        <div className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
          SCORE
        </div>
        <div className="text-xl font-extrabold tabular-nums text-primary">
          {score.toLocaleString()}
        </div>
      </div>
      <div className="rounded-2xl border border-primary/20 bg-white/[0.04] px-3 py-2 text-center">
        <div className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
          BEST SCORE
        </div>
        <div className="text-xl font-extrabold tabular-nums text-primary">
          {best.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
