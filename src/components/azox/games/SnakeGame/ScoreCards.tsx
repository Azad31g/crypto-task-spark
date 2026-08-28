export function ScoreCards({
  score,
  best,
}: {
  score: number;
  best: number;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 px-4">
      <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-center">
        <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">
          SCORE
        </div>
        <div className="text-2xl font-extrabold tabular-nums text-primary">
          {score.toLocaleString()}
        </div>
      </div>
      <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-center">
        <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">
          BEST SCORE
        </div>
        <div className="text-2xl font-extrabold tabular-nums text-gold">
          {best.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
