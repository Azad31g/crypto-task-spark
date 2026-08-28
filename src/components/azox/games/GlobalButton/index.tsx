import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useGameTasks } from "@/hooks/useGameTasks";
import { AZOX_IMAGES } from "@/lib/azox-images";
import { formatHMS, useGlobalButton } from "./useGlobalButton";

export default function GlobalButton() {
  const {
    isActive,
    hasPressed,
    missed,
    hydrated,
    timeUntilNext,
    timeLeft,
    spotsLeft,
    reward,
    handlePress,
  } = useGlobalButton();

  const { onGlobalButtonWin } = useGameTasks();
  const prevPressedRef = useRef(hasPressed);

  useEffect(() => {
    if (hasPressed && !prevPressedRef.current) {
      onGlobalButtonWin();
      toast.success("+1 Task earned! 🌍");
    }
    prevPressedRef.current = hasPressed;
  }, [hasPressed, onGlobalButtonWin]);

  const secondsLeft = Math.ceil(timeLeft / 1000);

  return (
    <div className="flex min-h-[70dvh] flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          to="/gaming"
          aria-label="Back to gaming hub"
          className="glass grid size-9 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-extrabold">The Global Button</h1>
      </div>

      <div className="glass flex flex-1 flex-col items-center justify-center gap-6 rounded-3xl p-6 text-center">
        {!hydrated ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : isActive && !hasPressed ? (
          <>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handlePress();
              }}
              className="grid size-56 select-none place-items-center rounded-full border-2 border-primary bg-primary/20 text-2xl font-black text-primary shadow-[0_0_60px_rgba(34,197,94,0.6)] transition-transform active:scale-95"
              style={{ animation: "pulse 1s ease-in-out infinite", touchAction: "none" }}
            >
              TAP NOW!
            </button>
            <p className="text-lg font-bold text-primary">
              {secondsLeft} seconds left
            </p>
          </>
        ) : hasPressed ? (
          <>
            <p className="text-2xl font-black text-primary">
              ✅ You pressed! +{reward} points
            </p>
            <p className="text-sm text-muted-foreground">Next round in</p>
            <p className="font-mono text-3xl font-extrabold text-primary">
              {formatHMS(timeUntilNext)}
            </p>
          </>
        ) : missed ? (
          <>
            <img
              src={AZOX_IMAGES["global-button"]}
              alt=""
              width={120}
              height={120}
              className="size-28 rounded-3xl object-contain opacity-60"
            />
            <p className="text-xl font-bold text-destructive">⏰ Too slow!</p>
            <p className="text-sm text-muted-foreground">Next round in</p>
            <p className="font-mono text-3xl font-extrabold text-primary">
              {formatHMS(timeUntilNext)}
            </p>
          </>
        ) : (
          <>
            <img
              src={AZOX_IMAGES["global-button"]}
              alt="The Global Button"
              width={140}
              height={140}
              className="size-32 rounded-3xl object-contain drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]"
            />
            <p className="text-sm text-muted-foreground">Next activation in</p>
            <p className="font-mono text-4xl font-extrabold text-primary">
              {formatHMS(timeUntilNext)}
            </p>
            <p className="text-sm font-semibold text-muted-foreground">
              {spotsLeft.toLocaleString("en-US")} spots available
            </p>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Activates every 3 hours (00:00, 03:00 … 21:00 UTC+3) for 20 seconds ·{" "}
          {reward} points per press
        </p>
      </div>
    </div>
  );
}
