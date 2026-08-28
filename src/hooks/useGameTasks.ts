import { useCallback } from "react";
import { externalSupabase as supabase } from "@/integrations/external-supabase/client";
import { readStorage, writeStorage } from "@/lib/points";
import { getTelegramUser } from "@/lib/telegram";
import { recordTaskUnits } from "@/lib/azox-backend";

const STREAK_KEY = "azox_daily_streak";

type StreakState = {
  dates: string[];
};

function today() {
  return new Date().toISOString().split("T")[0] as string;
}

/**
 * All game achievements are written as real rows in user_tasks — the single
 * source of truth for the task count shown in Profile and Task Rank.
 */
export function useGameTasks() {
  // AZOX Word — +2 Tasks when ALL 5 words answered correctly (once per day)
  const onWordComplete = useCallback((allCorrect: boolean) => {
    if (!allCorrect) return 0;
    void recordTaskUnits(`game-word-complete-${today()}`, 2);
    return 2;
  }, []);

  // AZOX Box — +1 Task when box opened successfully (once per box/day)
  const onBoxOpen = useCallback(() => {
    void recordTaskUnits(`game-box-open-${today()}`, 1);
    return 1;
  }, []);

  // Question Day — +2 Tasks when ALL questions answered correctly (once per day)
  const onQuestionComplete = useCallback((allCorrect: boolean) => {
    if (!allCorrect) return 0;
    void recordTaskUnits(`game-question-complete-${today()}`, 2);
    return 2;
  }, []);

  // Global Button — +1 Task each time successfully pressed
  const onGlobalButtonWin = useCallback(() => {
    void recordTaskUnits(`game-global-button-${Date.now()}`, 1);
    return 1;
  }, []);

  // Shoot / Snake / TakBom — +10 Tasks on new WORLD record (all users)
  const onNewGlobalBest = useCallback(
    async (gameId: string, newScore: number): Promise<number> => {
      if (newScore <= 0) return 0;

      // The ONE global best row for this game
      const { data: globalRecord } = await (supabase as any)
        .from("global_best_scores")
        .select("best_score")
        .eq("game_id", gameId)
        .maybeSingle();

      const currentGlobalBest = globalRecord?.best_score ?? 0;
      if (newScore <= currentGlobalBest) return 0;

      const tgUser = getTelegramUser();

      await (supabase as any).from("global_best_scores").upsert(
        {
          game_id: gameId,
          best_score: newScore,
          held_by: tgUser?.id ?? null,
          held_by_name: tgUser?.first_name ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "game_id" },
      );

      // Personal score record
      if (tgUser?.id) {
        await (supabase as any).from("game_scores").upsert(
          {
            telegram_id: tgUser.id,
            game_id: gameId,
            score: newScore,
            is_best: true,
          },
          { onConflict: "telegram_id,game_id" },
        );
      }

      // Award +10 tasks, idempotent per world record
      await recordTaskUnits(`game-world-record-${gameId}-${newScore}`, 10);

      return 10;
    },
    [],
  );

  // Daily Gift streak — +3 Tasks every 5 consecutive days
  const onDailyGiftClaimed = useCallback(() => {
    const streak = readStorage<StreakState>(STREAK_KEY, { dates: [] });
    const day = today();

    if (!streak.dates.includes(day)) {
      streak.dates.push(day);
      if (streak.dates.length > 10) streak.dates = streak.dates.slice(-10);
    }

    let tasksEarned = 0;
    if (streak.dates.length >= 5) {
      const last5 = [...streak.dates].sort().slice(-5);
      let consecutive = true;
      for (let i = 1; i < last5.length; i++) {
        const diff =
          (new Date(last5[i]!).getTime() - new Date(last5[i - 1]!).getTime()) /
          86_400_000;
        if (diff !== 1) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) {
        tasksEarned = 3;
        void recordTaskUnits(`game-streak-${day}`, 3);
        streak.dates = [];
      }
    }

    writeStorage(STREAK_KEY, streak);
    return tasksEarned;
  }, []);

  const getStreak = useCallback(
    () => readStorage<StreakState>(STREAK_KEY, { dates: [] }).dates.length,
    [],
  );

  return {
    onWordComplete,
    onBoxOpen,
    onQuestionComplete,
    onGlobalButtonWin,
    onNewGlobalBest,
    onDailyGiftClaimed,
    getStreak,
  };
}
