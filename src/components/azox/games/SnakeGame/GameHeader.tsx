import { Link } from "@tanstack/react-router";
import { ArrowLeft, Menu } from "lucide-react";
import { AZOX_IMAGES } from "@/lib/azox-images";
import { formatPoints } from "@/lib/azox-data";

export function GameHeader({
  points,
  onMenu,
}: {
  points: number;
  onMenu: () => void;
}) {
  return (
    <header className="flex items-center gap-3 px-4 pt-4">
      <Link
        to="/gaming"
        aria-label="Back to gaming hub"
        className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/40 bg-white/[0.03] text-primary"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
      </Link>
      <img
        src={AZOX_IMAGES.snake}
        alt=""
        width={32}
        height={32}
        className="size-8 object-contain"
      />
      <h1 className="text-lg font-extrabold tracking-tight">
        AZOX <span className="text-primary">Snake</span>
      </h1>
      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-sm font-bold tabular-nums">
          <img
            src={AZOX_IMAGES.token}
            alt=""
            width={18}
            height={18}
            className="size-[18px] object-contain"
          />
          {formatPoints(points)}
        </span>
        <button
          type="button"
          aria-label="Game menu"
          onPointerDown={onMenu}
          className="grid size-11 place-items-center rounded-xl text-foreground/80"
        >
          <Menu className="size-6" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
