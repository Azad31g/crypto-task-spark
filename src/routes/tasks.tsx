import { createFileRoute } from "@tanstack/react-router";
import { TaskPage } from "@/components/azox/pages/task-page";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "AZOX Tasks — Daily Gift & Social Rewards" },
      {
        name: "description",
        content:
          "Claim your AZOX daily gift and complete Telegram, X, Instagram, TikTok, YouTube and Discord tasks.",
      },
      { property: "og:title", content: "AZOX Tasks — Daily Gift & Social Rewards" },
      {
        property: "og:description",
        content: "Claim the daily gift and finish social tasks for AZOX points.",
      },
    ],
  }),
  component: TaskPage,
});
