import { Link } from "@tanstack/react-router";
import { ChevronLeft, MoreVertical } from "lucide-react";

export function GameHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <Link
        to="/gaming"
        aria-label="Back to gaming"
        className="grid h-9 w-9 place-items-center rounded-full text-primary"
      >
        <ChevronLeft className="h-7 w-7" />
      </Link>
      <h1 className="text-xl font-extrabold tracking-tight text-primary text-glow-orange">
        Azox Tak Bom
      </h1>
      <button
        type="button"
        onClick={onMenu}
        aria-label="Menu"
        className="grid h-9 w-9 place-items-center rounded-full text-primary"
      >
        <MoreVertical className="h-6 w-6" />
      </button>
    </div>
  );
}
