import { useEffect, useRef, useState } from "react";
import { Game, preloadSprites } from "./engine";
import type { ShootGameOverPayload } from "./types";

export function GameCanvas({
  onReady,
  onScore,
  onTime,
  onGameOver,
}: {
  onReady: (game: Game) => void;
  onScore: (score: number) => void;
  onTime: (ms: number) => void;
  onGameOver: (payload: ShootGameOverPayload) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);

  // Latest callbacks without re-creating the engine.
  const cbs = useRef({ onReady, onScore, onTime, onGameOver });
  cbs.current = { onReady, onScore, onTime, onGameOver };

  useEffect(() => {
    let mounted = true;
    let game: Game | null = null;
    void (async () => {
      const sprites = await preloadSprites();
      if (!mounted || !canvasRef.current) return;
      game = new Game(canvasRef.current, sprites, {
        onScore: (s) => cbs.current.onScore(s),
        onTime: (t) => cbs.current.onTime(t),
        onGameOver: (p) => cbs.current.onGameOver(p),
      });
      game.attach();
      game.start();
      cbs.current.onReady(game);
      setLoading(false);
    })();
    return () => {
      mounted = false;
      game?.detach();
    };
  }, []);

  return (
    <div className="relative mt-2 flex-1 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ touchAction: "none" }}
      />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-sm text-neutral-400">Loading…</div>
        </div>
      ) : null}
    </div>
  );
}
