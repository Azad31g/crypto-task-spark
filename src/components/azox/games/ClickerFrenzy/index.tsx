import { Link } from "@tanstack/react-router";
import { ArrowLeft, Coins, Trophy } from "lucide-react";
import { useAzox } from "@/components/azox/app-provider";
import { formatPoints } from "@/lib/azox-data";
import FloatingPoints from "./FloatingPoints";
import TapZone from "./TapZone";
import {
  POINTS_PER_TAP,
  formatHMS,
  formatMS,
  useClickerFrenzy,
} from "./useClickerLogic";

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1 px-2 py-2 text-center">
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className="font-mono text-xl font-black tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

export default function ClickerFrenzy() {
  const { points: accountPoints } = useAzox();
  const g = useClickerFrenzy();

  const tapState =
    g.phase === "playing" ? "playing" : g.phase === "ready" ? "ready" : "locked";

  return (
    <div
      className="relative flex min-h-[80dvh] flex-col gap-5"
      style={{
        background:
          g.phase === "playing" && Date.now() - g.flash < 100
            ? "rgba(255,122,24,0.1)"
            : "transparent",
        transition: "background 100ms",
      }}
    >
      {g.phase === "playing" ? (
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            boxShadow: g.urgent
              ? "inset 0 0 90px rgba(239,68,68,0.35)"
              : "inset 0 0 80px rgba(255,122,24,0.25)",
          }}
          aria-hidden="true"
        />
      ) : null}

      <header className="relative z-10 flex items-center gap-3">
        <Link
          to="/gaming"
          aria-label="Back to gaming hub"
          className="glass grid size-9 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <h1 className="flex-1 text-lg font-black" style={{ color: "#FF7A18" }}>
          Clicker Frenzy
        </h1>
        <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-bold tabular-nums">
          <Coins className="size-3.5" style={{ color: "#FFD700" }} aria-hidden="true" />
          {formatPoints(accountPoints)}
        </span>
      </header>

      <div
        className="relative z-10 flex items-center rounded-2xl border"
        style={{ background: "#0d0d0d", borderColor: "rgba(255,122,24,0.35)" }}
      >
        <Stat label="TAPS" value={g.taps.toLocaleString("en-US")} />
        <div className="h-10 w-px bg-border" />
        <Stat label="POINTS" value={g.points.toLocaleString("en-US")} color="#FFD700" />
        <div className="h-10 w-px bg-border" />
        <Stat
          label="TIME"
          value={formatMS(g.timeLeft)}
          color={g.urgent ? "#ef4444" : "#22c55e"}
        />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 text-center">
        {g.phase === "loading" ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <TapZone
              state={tapState}
              onTap={g.handleTap}
              label={
                g.phase === "cooldown" || g.phase === "over"
                  ? "LOCKED"
                  : g.phase === "playing"
                    ? "TAP!"
                    : "TAP TO START"
              }
            />

            {g.urgent ? (
              <p className="animate-pulse text-lg font-black" style={{ color: "#ef4444" }}>
                FASTER!
              </p>
            ) : null}

            {g.phase === "ready" ? (
              <>
                <p className="text-sm font-bold" style={{ color: "#FFD700" }}>
                  Best: {g.best.points.toLocaleString("en-US")} pts
                </p>
                <p className="text-xs text-muted-foreground">
                  {POINTS_PER_TAP} pts per tap • 30 seconds • multi-touch
                </p>
              </>
            ) : null}

            {g.phase === "cooldown" ? (
              <>
                <p className="text-sm font-bold" style={{ color: "#FF7A18" }}>
                  Come back in {formatHMS(g.cooldownLeft)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Next challenge unlocks soon
                </p>
                <p className="text-xs text-muted-foreground">
                  Last round: {g.last.taps.toLocaleString("en-US")} taps •{" "}
                  {g.last.points.toLocaleString("en-US")} pts
                </p>
              </>
            ) : null}
          </>
        )}
      </div>

      {g.phase === "over" ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/80 p-6">
          <div
            className="w-full max-w-xs rounded-3xl border p-6 text-center"
            style={{ background: "#0d0d0d", borderColor: "#FF7A18" }}
          >
            <p className="text-base font-black" style={{ color: "#FF7A18" }}>
              ⚡ FRENZY COMPLETE!
            </p>
            <div className="mt-4 space-y-1 text-sm">
              <p>
                Your Taps:{" "}
                <span className="font-bold">{g.taps.toLocaleString("en-US")}</span>
              </p>
              <p>
                Points Earned:{" "}
                <span className="font-bold" style={{ color: "#FFD700" }}>
                  {g.points.toLocaleString("en-US")}
                </span>
              </p>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-bold">
              <Trophy className="size-4" style={{ color: "#FFD700" }} aria-hidden="true" />
              Best: {g.best.points.toLocaleString("en-US")} pts
            </p>
            {g.newRecord ? (
              <p
                className="mt-1 animate-pulse text-xs font-black"
                style={{ color: "#22c55e" }}
              >
                🏆 NEW RECORD!
              </p>
            ) : null}
            <p
              className="mt-4 rounded-xl border px-3 py-2 font-mono text-sm font-bold"
              style={{ borderColor: "rgba(255,122,24,0.4)", color: "#FF7A18" }}
            >
              Next round in {formatHMS(g.cooldownLeft)}
            </p>
            <Link
              to="/gaming"
              className="mt-4 block rounded-xl px-4 py-2.5 text-sm font-black text-black"
              style={{ background: "#FF7A18" }}
            >
              EXIT
            </Link>
          </div>
        </div>
      ) : null}

      <FloatingPoints items={g.floating} />
    </div>
  );
}
