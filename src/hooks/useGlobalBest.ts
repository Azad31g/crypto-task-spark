import { useCallback, useEffect, useState } from "react";
import { externalSupabase as supabase } from "@/integrations/external-supabase/client";

/** Reads the single all-time world record row for a game. */
export function useGlobalBest(gameId: string) {
  const [globalBest, setGlobalBest] = useState(0);

  const refresh = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("global_best_scores")
      .select("best_score")
      .eq("game_id", gameId)
      .maybeSingle();
    const value = data?.best_score ?? 0;
    setGlobalBest((prev) => (value > prev ? value : prev));
    return value as number;
  }, [gameId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await (supabase as any)
        .from("global_best_scores")
        .select("best_score")
        .eq("game_id", gameId)
        .maybeSingle();
      if (!cancelled) setGlobalBest(data?.best_score ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  /** Optimistically raise the displayed world best after a new record. */
  const bumpGlobalBest = useCallback((score: number) => {
    setGlobalBest((prev) => (score > prev ? score : prev));
  }, []);

  return { globalBest, refresh, bumpGlobalBest };
}
