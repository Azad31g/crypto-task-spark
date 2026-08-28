import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useGameTasks } from "@/hooks/useGameTasks";
import { useGlobalBest } from "@/hooks/useGlobalBest";

import { readStorage, writeStorage } from "@/lib/points";
import { initTelegram } from "@/lib/telegram";
import { GameCanvas } from "./GameCanvas";
import { GameHeader, fmtTime } from "./GameHeader";
import { SHOOT_BEST_KEY, type ShootGameOverState } from "./types";
import type { Game } from "./engine";

export default function ShootGame({
  onGameOver,
}: {
  onGameOver?: (score: number) => void;
}) {
  const { onNewGlobalBest } = useGameTasks();
  const { globalBest: best, refresh: refreshGlobalBest, bumpGlobalBest } =
    useGlobalBest("shoot");
  const gameRef = useRef<Game | null>(null);
  const finalScoreRef = useRef(0);
  const [score, setScore] = useState(0);
  const [timeMs, setTimeMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState<ShootGameOverState | null>(null);

  useEffect(() => {
    initTelegram();
  }, []);

  const handleTogglePause = () => {
    const game = gameRef.current;
    if (!game || over) return;
    if (paused) {
      game.resume();
      setPaused(false);
    } else {
      game.pause();
      setPaused(true);
    }
  };

  const handleRestart = () => {
    setOver(null);
    setPaused(false);
    setScore(0);
    setTimeMs(0);
    gameRef.current?.restart();
  };

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden bg-black text-white select-none">
      <GameHeader
        score={score}
        best={best}
        timeMs={timeMs}
        paused={paused}
        onTogglePause={handleTogglePause}
      />
      <GameCanvas
        onReady={(game) => {
          gameRef.current = game;
        }}
        onScore={setScore}
        onTime={setTimeMs}
        onGameOver={(p) => {
          finalScoreRef.current = p.finalScore;
          const previousBest = readStorage<number>(SHOOT_BEST_KEY, 0);
          const newRecord = p.finalScore > previousBest;
          if (newRecord) writeStorage(SHOOT_BEST_KEY, p.finalScore);
          setOver({ ...p, newRecord });
          onNewGlobalBest("shoot", finalScoreRef.current).then((earnedTasks) => {
            if (earnedTasks > 0) {
              bumpGlobalBest(p.finalScore);
              toast.success("+10 Tasks earned! 🏆 New Global Best!");
            } else {
              void refreshGlobalBest();
            }
          });
          onGameOver?.(p.finalScore);
          try {
            window.parent?.postMessage(
              { type: "SHOOT_SCORE", points: p.finalScore },
              "*",
            );
          } catch {
            // cross-origin parent — ignore
          }
        }}
      />

      {paused && !over ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-64 rounded-2xl border border-white/10 bg-neutral-900 p-5 text-center">
            <div className="text-lg font-semibold">Paused</div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleTogglePause}
                className="rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-black"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="rounded-lg border border-white/10 bg-neutral-800 py-2 text-sm font-semibold"
              >
                Restart
              </button>
              <Link
                to="/gaming"
                className="rounded-lg border border-white/10 bg-neutral-800 py-2 text-sm font-semibold"
              >
                Exit
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {over ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-72 rounded-2xl border border-white/10 bg-neutral-900 p-6 text-center">
            <div className="text-2xl font-bold tracking-tight text-orange-400">
              Game Over
            </div>
            {over.newRecord ? (
              <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-yellow-400">
                New Record!
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2 text-left">
              <div className="rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-neutral-400">
                  Score
                </div>
                <div className="text-lg font-bold tabular-nums text-orange-400">
                  {over.finalScore.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-neutral-400">
                  Best
                </div>
                <div className="text-lg font-bold tabular-nums text-yellow-400">
                  {best.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-neutral-400">
                  Time
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {fmtTime(over.durationMs)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-neutral-400">
                  Kills
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {over.enemiesDestroyed}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleRestart}
                className="rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-black"
              >
                Play Again
              </button>
              <Link
                to="/gaming"
                className="block rounded-lg border border-white/10 bg-neutral-800 py-2.5 text-sm font-semibold"
              >
                Exit
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
