import { useCallback, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS, readStorage, todayKey, writeStorage } from "@/lib/points";
import { recordTaskCompletion, recordTaskUnits } from "@/lib/azox-backend";

export const DAILY_GIFT_POINTS = 200;

type TasksState = { completed: string[]; dailyClaimedOn: string | null };

const DEFAULT: TasksState = { completed: [], dailyClaimedOn: null };

export function useTasks(onEarn?: (amount: number) => void) {
  const [state, setState] = useState<TasksState>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStorage<Partial<TasksState>>(STORAGE_KEYS.tasks, {});
    setState({
      completed: Array.isArray(stored.completed) ? stored.completed : [],
      dailyClaimedOn:
        typeof stored.dailyClaimedOn === "string" ? stored.dailyClaimedOn : null,
    });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(STORAGE_KEYS.tasks, state);
  }, [state, hydrated]);

  const completedTasks = useMemo(
    () => new Set(state.completed),
    [state.completed],
  );

  const completeTask = useCallback(
    (id: string, fallbackPoints?: number, taskReward?: number) => {
      if (state.completed.includes(id)) return 0;
      const points = fallbackPoints ?? 0;
      setState((prev) =>
        prev.completed.includes(id)
          ? prev
          : { ...prev, completed: [...prev.completed, id] },
      );
      // onEarn already awards points on the server through usePoints.
      if (points > 0) onEarn?.(points);
      void recordTaskCompletion(id, 0);
      // Extra task units for this task are recorded in user_tasks too,
      // so the DB stays the single source of truth.
      if (taskReward && taskReward > 0) {
        void recordTaskUnits(`${id}-reward`, taskReward);
      }


      // users.tasks_done is mirrored from user_tasks inside
      // recordTaskCompletion — the single source of truth.


      return points;
    },
    [onEarn, state.completed],
  );

  const dailyClaimed = hydrated && state.dailyClaimedOn === todayKey();

  const claimDaily = useCallback(() => {
    let claimed = false;
    setState((prev) => {
      const day = todayKey();
      if (prev.dailyClaimedOn === day) return prev;
      claimed = true;
      return { ...prev, dailyClaimedOn: day };
    });
    if (claimed) onEarn?.(DAILY_GIFT_POINTS);
    return claimed;
  }, [onEarn]);

  return {
    completedTasks,
    completeTask,
    isCompleted: (id: string) => completedTasks.has(id),
    dailyClaimed,
    claimDaily,
    hydrated,
  };
}
