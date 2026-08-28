import { useMemo } from "react";
import {
  LEADERBOARD,
  RANKS,
  type LeaderboardUser,
  type RankKey,
} from "@/lib/azox-data";

export const RANK_ORDER: RankKey[] = [
  "Legendary",
  "Epic",
  "Diamond",
  "Platinum",
  "Gold",
  "Silver",
  "Bronze",
];

export type LeaderboardEntry = LeaderboardUser & { position: number };

/** Seed leaderboard data: 3 players per rank, sorted by points. */
export function useLeaderboard(rank?: RankKey) {
  return useMemo(() => {
    const byRank = RANK_ORDER.reduce(
      (acc, key) => {
        acc[key] = [...(LEADERBOARD[key] ?? [])]
          .sort((a, b) => b.points - a.points)
          .map((u, i) => ({ ...u, position: i + 1 }));
        return acc;
      },
      {} as Record<RankKey, LeaderboardEntry[]>,
    );

    return {
      order: RANK_ORDER,
      byRank,
      players: rank ? byRank[rank] : RANK_ORDER.flatMap((k) => byRank[k]),
      thresholdFor: (key: RankKey) =>
        RANKS.find((r) => r.key === key)?.threshold ?? 0,
      colorFor: (key: RankKey) =>
        RANKS.find((r) => r.key === key)?.color ?? "#ffffff",
    };
  }, [rank]);
}
