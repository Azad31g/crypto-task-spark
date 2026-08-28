import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAzox } from "@/components/azox/app-provider";
import { useGameTasks } from "@/hooks/useGameTasks";
import { useGlobalBest } from "@/hooks/useGlobalBest";

import { FallingObject } from "./FallingObject";
import { GameGrid } from "./GameGrid";
import { GameHeader } from "./GameHeader";
import { ScoreBar } from "./ScoreBar";
import { useTakBomLogic } from "./useTakBomLogic";

export default function TakBomGame() {
  const { addPoints } = useAzox();
  const finalScoreRef = useRef(0);

  const game = useTakBomLogic((score) => {
    if (score > 0) addPoints(score);
    finalScoreRef.current = score;
  });

  const { onNewGlobalBest } = useGameTasks();
  const { globalBest, refresh: refreshGlobalBest, bumpGlobalBest } =
    useGlobalBest("takbom");
  const overFiredRef = useRef(false);

  useEffect(() => {
    if (game.state !== "over") {
      overFiredRef.current = false;
      return;
    }
    if (overFiredRef.current) return;
    overFiredRef.current = true;
    const finalScore = finalScoreRef.current;
    onNewGlobalBest("takbom", finalScore).then((earnedTasks) => {
      if (earnedTasks > 0) {
        bumpGlobalBest(finalScore);
        toast.success("+10 Tasks earned! 🏆 New Global Best!");
      } else {
        void refreshGlobalBest();
      }
    });
  }, [game.state, game.score, onNewGlobalBest, bumpGlobalBest, refreshGlobalBest]);

  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!game.boomAt) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 500);
    return () => window.clearTimeout(t);
  }, [game.boomAt]);

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-full select-none overflow-hidden bg-black text-white">
      <div className="relative mx-auto flex h-full w-full max-w-[600px] flex-col">
        <div className="relative z-20 border-b border-primary/15 bg-black/80 backdrop-blur">
          <GameHeader
            onMenu={() => (game.state === "paused" ? game.resume() : game.pause())}
          />
          <ScoreBar timeLeft={game.timeLeft} score={game.score} best={globalBest} />
        </div>

        <div className="relative flex-1 overflow-hidden">
          <GameGrid />

          <div className="absolute inset-0" style={{ zIndex: 10, pointerEvents: "none" }}>
            {game.objects.map((obj) => (
              <FallingObject
                key={obj.id}
                obj={obj}
                onTap={game.tapObject}
                onDone={game.removeObject}
              />
            ))}
          </div>

          {flash ? (
            <div className="pointer-events-none absolute inset-0 z-30 bg-yellow-400/30" />
          ) : null}

          {game.state === "start" ? (
            <button
              type="button"
              onClick={game.start}
              className="absolute inset-0 z-30 grid place-items-center bg-black/70 text-center backdrop-blur-sm"
            >
              <div>
                <div className="text-2xl font-extrabold">
                  AZOX <span className="text-primary">Tak Bom</span>
                </div>
                <div className="mt-2 text-sm font-semibold tracking-widest text-primary">
                  TAP TO START
                </div>
                <div className="mt-2 max-w-[16rem] text-xs text-muted-foreground">
                  Tap green stars for +50 points. Never tap the yellow bomb — it
                  wipes your score.
                </div>
              </div>
            </button>
          ) : null}

          {game.state === "paused" ? (
            <div className="absolute inset-0 z-30 grid place-items-center bg-black/80 backdrop-blur-sm">
              <div className="w-52 text-center">
                <div className="text-xl font-extrabold tracking-widest">PAUSED</div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={game.resume}
                    className="rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={game.start}
                    className="rounded-xl border border-white/15 py-2 text-sm font-semibold"
                  >
                    Restart
                  </button>
                  <Link
                    to="/gaming"
                    className="rounded-xl border border-white/15 py-2 text-sm font-semibold"
                  >
                    Exit
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {game.state === "over" ? (
            <div className="absolute inset-0 z-30 grid place-items-center bg-black/85 backdrop-blur-sm">
              <div className="w-60 text-center">
                <div className="text-2xl font-extrabold tracking-tight text-primary">
                  TIME&apos;S UP!
                </div>
                {game.newRecord ? (
                  <div className="mt-1 text-xs font-bold uppercase tracking-widest text-gold">
                    New Record! 🏆
                  </div>
                ) : null}
                <div className="mt-3 text-3xl font-extrabold tabular-nums text-primary">
                  {game.score.toLocaleString()}
                </div>
                <div className="text-[11px] tracking-widest text-muted-foreground">
                  FINAL SCORE
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Best:{" "}
                  <span className="font-bold text-gold">
                    {globalBest.toLocaleString()}
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={game.start}
                    className="rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
                  >
                    PLAY AGAIN
                  </button>
                  <Link
                    to="/gaming"
                    className="rounded-xl border border-white/15 py-2.5 text-sm font-semibold"
                  >
                    EXIT
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
