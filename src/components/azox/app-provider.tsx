import { useMemo, type ReactNode } from "react";
import { usePoints } from "@/hooks/usePoints";
import { useTasks } from "@/hooks/useTasks";
import { useUser } from "@/hooks/useUser";
import { useBoxAlert } from "@/hooks/useBoxAlert";
import { AzoxContext, useAzox, type AzoxState } from "@/components/azox/azox-context";

export { useAzox };
export type { AzoxState };

export function AzoxProvider({ children }: { children: ReactNode }) {
  const { user, dbUser } = useUser();
  const {
    points,
    rank,
    nextRank,
    progress,
    level,
    addPoints,
    tap,
    globalWins,
  } = usePoints();
  const { completedTasks, completeTask, dailyClaimed, claimDaily } =
    useTasks(addPoints);
  const boxAlert = useBoxAlert();

  const value = useMemo<AzoxState>(
    () => ({
      user,
      dbUser,
      points,
      rank,
      nextRank,
      progress,
      level,
      addPoints,
      tap,
      completedTasks,
      completeTask,
      dailyClaimed,
      claimDaily,
      globalWins,
      referrals: dbUser?.referral_count ?? 0,
      isBoxOpen: boxAlert.isBoxOpen,
      boxSecondsRemaining: boxAlert.secondsRemaining,
      boxAlreadyOpened: boxAlert.alreadyOpened,
    }),
    [
      user,
      dbUser,
      points,
      rank,
      nextRank,
      progress,
      level,
      addPoints,
      tap,
      completedTasks,
      completeTask,
      dailyClaimed,
      claimDaily,
      globalWins,
      boxAlert,
    ],
  );

  return <AzoxContext.Provider value={value}>{children}</AzoxContext.Provider>;
}

