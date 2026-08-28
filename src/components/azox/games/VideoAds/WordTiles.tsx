type Tile = { id: number; letter: string };

export default function WordTiles({
  pool,
  disabled,
  onPick,
}: {
  pool: Tile[];
  disabled: boolean;
  onPick: (id: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {pool.map((tile) => (
        <button
          key={tile.id}
          type="button"
          disabled={disabled}
          onPointerDown={(e) => {
            e.preventDefault();
            onPick(tile.id);
          }}
          style={{ touchAction: "none", userSelect: "none" }}
          className="grid size-14 place-items-center rounded-lg border-2 border-primary bg-secondary/60 text-2xl font-black text-foreground transition-transform active:scale-90 disabled:opacity-30"
        >
          {tile.letter}
        </button>
      ))}
      {pool.length === 0 ? (
        <p className="py-4 text-xs text-muted-foreground">All letters placed</p>
      ) : null}
    </div>
  );
}
