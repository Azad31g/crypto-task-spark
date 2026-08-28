import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAzox } from "@/components/azox/app-provider";
import { useGameTasks } from "@/hooks/useGameTasks";
import { useGlobalBest } from "@/hooks/useGlobalBest";

import { GameBoard } from "./GameBoard";
import { GameHeader } from "./GameHeader";
import Joystick from "./Joystick";
import { ScoreCards } from "./ScoreCards";
import { useSnakeLogic } from "./useSnakeLogic";

export default function SnakeGame() {
  const { points, addPoints } = useAzox();
  const finalScoreRef = useRef(0);

  const game = useSnakeLogic((score) => {
    if (score > 0) addPoints(score);
    finalScoreRef.current = score;
  });

  const { onNewGlobalBest } = useGameTasks();
  const { globalBest, refresh: refreshGlobalBest, bumpGlobalBest } =
    useGlobalBest("snake");
  const overFiredRef = useRef(false);

  useEffect(() => {
    if (game.state !== "over") {
      overFiredRef.current = false;
      return;
    }
    if (overFiredRef.current) return;
    overFiredRef.current = true;
    const finalScore = finalScoreRef.current;
    onNewGlobalBest("snake", finalScore).then((earnedTasks) => {
      if (earnedTasks > 0) {
        bumpGlobalBest(finalScore);
        toast.success("+10 Tasks earned! 🏆 New Global Best!");
      } else {
        void refreshGlobalBest();
      }
    });
  }, [game.state, game.score, onNewGlobalBest, bumpGlobalBest, refreshGlobalBest]);

  return (
    <div
      className="fixed inset-0 z-50 min-h-[100dvh] w-full select-none overflow-y-auto bg-black text-white"
      style={{ touchAction: "none", userSelect: "none" }}
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[600px] flex-col items-center">
        <div className="w-full">
          <GameHeader
            points={points}
            onMenu={() => (game.state === "paused" ? game.resume() : game.pause())}
          />
          <ScoreCards score={game.score} best={globalBest} />
        </div>

      <div className="mt-3 flex w-full justify-center">
        <GameBoard
          snake={game.snake}
          items={game.items}
          rocks={game.rocks}
          gameState={game.state}
          onStart={game.start}
          onSwipe={game.setDirection}
        >
          {game.state === "start" ? (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                game.start();
              }}
              className="absolute inset-0 z-50 grid place-items-center bg-black/70 text-center backdrop-blur-sm"
            >
              <div>
                <div className="text-2xl font-extrabold">
                  AZOX <span className="text-primary">Snake</span>
                </div>
                <div className="mt-2 text-sm font-semibold tracking-widest text-primary">
                  TAP TO START
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  or press any arrow / WASD key
                </div>
                {globalBest > 0 ? (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Best: <span className="font-bold text-gold">{globalBest.toLocaleString()}</span>
                  </div>
                ) : null}
              </div>
            </button>
          ) : null}

          {game.state === "paused" ? (
            <div className="absolute inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm">
              <div className="w-52 text-center">
                <div className="text-xl font-extrabold tracking-widest">PAUSED</div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      game.resume();
                    }}
                    className="rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      game.start();
                    }}
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
            <div className="absolute inset-0 z-50 grid place-items-center bg-black/85 backdrop-blur-sm">
              <div className="w-56 text-center">
                <div className="text-2xl font-extrabold tracking-tight text-red-500">
                  GAME OVER
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
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      game.start();
                    }}
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
        </GameBoard>
      </div>

        <Joystick
          onMove={(dir: string) => {
            if (dir === 'up') game.setDirection('up')
            if (dir === 'down') game.setDirection('down')
            if (dir === 'left') game.setDirection('left')
            if (dir === 'right') game.setDirection('right')
          }}
        />
      </div>
    </div>
  );
}
