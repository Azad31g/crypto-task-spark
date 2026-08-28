type Tile = { id: number; letter: string };

export default function AnswerSlots({
  length,
  placed,
  state,
  onReturn,
}: {
  length: number;
  placed: Tile[];
  state: "playing" | "correct" | "wrong" | "timeup";
  onReturn: (id: number) => void;
}) {
  const slots = Array.from({ length }, (_, i) => placed[i] ?? null);
  const border =
    state === "correct"
      ? "border-success text-success"
      : state === "wrong" || state === "timeup"
        ? "border-destructive text-destructive"
        : "border-border";

  return (
    <div
      className={`flex flex-wrap justify-center gap-2 ${state === "wrong" ? "animate-azox-shake" : ""}`}
    >
      {slots.map((tile, i) =>
        tile ? (
          <button
            key={`${tile.id}-${i}`}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onReturn(tile.id);
            }}
            style={{ touchAction: "none", userSelect: "none" }}
            className={`grid size-12 place-items-center rounded-lg border-2 bg-secondary/40 text-xl font-black transition-transform active:scale-90 ${border} ${state === "correct" ? "bg-success/15" : ""}`}
          >
            {tile.letter}
          </button>
        ) : (
          <span
            key={`empty-${i}`}
            className="grid size-12 place-items-center rounded-lg border-2 border-dashed border-border/70 text-lg text-muted-foreground"
          >
            _
          </span>
        ),
      )}
    </div>
  );
}
