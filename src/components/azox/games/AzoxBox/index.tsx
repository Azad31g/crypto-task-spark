import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useGameTasks } from "@/hooks/useGameTasks";
import { BoxAnimation } from "./BoxAnimation";
import { BOXES_PER_DAY, BOX_REWARD, MAX_WINNERS, SESSION_SECONDS, useAzoxBox } from "./useAzoxBox";

export default function AzoxBox() {
  const box = useAzoxBox();
  const { onBoxOpen } = useGameTasks();
  const boxTaskFiredRef = useRef(false);

  useEffect(() => {
    if (!box.justOpened) {
      boxTaskFiredRef.current = false;
      return;
    }
    if (boxTaskFiredRef.current) return;
    boxTaskFiredRef.current = true;
    onBoxOpen();
    toast.success("+1 Task earned! 📦");
  }, [box.justOpened, onBoxOpen]);

  const phase = box.justOpened
    ? "opened"
    : box.isActive && !box.hasOpened
      ? "active"
      : ("idle" as const);

  return (
    <div
      className={`flex min-h-[70dvh] flex-col gap-6 ${
        phase === "active" ? "azox-box-bg" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <Link
          to="/gaming"
          aria-label="Back to gaming hub"
          className="glass grid size-9 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-extrabold">AZOX Box</h1>
      </div>

      <div className="glass flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl p-6 text-center">
        {!box.hydrated ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <BoxAnimation phase={phase} />

            {phase === "opened" ? (
              <>
                <p className="text-2xl font-extrabold text-[#FFD166]">
                  +{BOX_REWARD.toLocaleString()} AZOX Points! 🎉
                </p>
                <p className="text-sm text-muted-foreground">
                  📦 Check back anytime — boxes appear randomly
                </p>
              </>
            ) : box.isActive && box.hasOpened ? (
              <>
                <p className="text-lg font-bold text-primary">Already opened ✅</p>
                <p className="text-sm text-muted-foreground">
                  📦 Check back anytime — boxes appear randomly
                </p>
              </>
            ) : box.isActive ? (
              <>
                <p className="animate-pulse text-2xl font-extrabold text-[#FF7A18]">
                  🎁 BOX IS OPEN!
                </p>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    box.openBox();
                  }}
                  className="animate-pulse rounded-2xl bg-[#FF7A18] px-10 py-5 text-xl font-extrabold text-black shadow-[0_0_30px_#FF7A18] active:scale-95"
                >
                  OPEN NOW!
                </button>
                <div className="w-full max-w-xs">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#FF7A18] transition-[width] duration-1000 ease-linear"
                      style={{
                        width: `${(box.secondsRemaining / SESSION_SECONDS) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#FF7A18]">
                    {box.secondsRemaining} seconds remaining to open!
                  </p>
                </div>
              </>
            ) : box.missed ? (
              <>
                <p className="text-lg font-bold text-destructive">⏰ You missed this box!</p>
                <p className="text-sm text-muted-foreground">
                  Stay alert — another could appear anytime
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">
                  📦 Check back anytime — boxes appear randomly
                </p>
                <p className="text-sm text-muted-foreground">
                  Boxes appear randomly throughout the day
                </p>
                <p className="text-xs text-muted-foreground">
                  Up to {BOXES_PER_DAY} boxes per day • {MAX_WINNERS.toLocaleString()} spots each
                </p>
                <p className="text-xs font-semibold text-primary">
                  {BOX_REWARD.toLocaleString()} points per box
                </p>
              </>
            )}

            <p className="text-[11px] text-muted-foreground">
              {box.appearedToday} boxes appeared today • You caught: {box.openedCount} • Earned{" "}
              {box.pointsToday.toLocaleString()} pts
            </p>
          </>
        )}
      </div>
    </div>
  );
}
