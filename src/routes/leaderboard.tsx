import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardPage } from "@/components/azox/pages/leaderboard-page";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "AZOX Ranks — Global Leaderboard" },
      {
        name: "description",
        content:
          "See the AZOX global leaderboard across 7 ranks, from Bronze to Legendary.",
      },
      { property: "og:title", content: "AZOX Ranks — Global Leaderboard" },
      {
        property: "og:description",
        content: "Global AZOX leaderboard across 7 ranks, Bronze to Legendary.",
      },
    ],
  }),
  component: LeaderboardPage,
});
