import { createContext, useContext } from "react";
import type { AzoxUser } from "@/hooks/useUser";
import type { DbUser } from "@/lib/azox-backend";
import type { Rank } from "@/lib/azox-data";

export type AzoxState = {
  user: AzoxUser;
  dbUser: DbUser | null;
  points: number;
  rank: Rank;
  nextRank: Rank | null;
  progress: number;
  level: number;
  addPoints: (n: number) => void;
  tap: (fingers?: number) => number;
  completedTasks: Set<string>;
  completeTask: (id: string, fallbackPoints?: number, taskReward?: number) => void;
  dailyClaimed: boolean;
  claimDaily: () => void;
  globalWins: number;
  referrals: number;
  isBoxOpen: boolean;
  boxSecondsRemaining: number;
  boxAlreadyOpened: boolean;
};

export const AzoxContext = createContext<AzoxState | null>(null);

export function useAzox() {
  const ctx = useContext(AzoxContext);
  if (!ctx) throw new Error("useAzox must be used within AzoxProvider");
  return ctx;
}
