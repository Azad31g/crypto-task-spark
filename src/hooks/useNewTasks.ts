import { useCallback, useEffect, useState } from "react";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";

const COUNT_KEY = "azox_tasks_last_count";

/** Red-dot state for the Tasks nav item: true when new tasks appeared. */
export function useNewTasks() {
  const { groups, loading } = useSupabaseTasks();
  const [hasNew, setHasNew] = useState(false);

  const total = groups.reduce((sum, g) => sum + g.tasks.length, 0);

  useEffect(() => {
    if (loading) return;
    const stored = Number(localStorage.getItem(COUNT_KEY) ?? "0");
    setHasNew(total > stored);
  }, [loading, total]);

  const markSeen = useCallback(() => {
    if (loading) return;
    localStorage.setItem(COUNT_KEY, String(total));
    setHasNew(false);
  }, [loading, total]);

  return { hasNew, markSeen, total };
}
