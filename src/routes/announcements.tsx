import { createFileRoute } from "@tanstack/react-router";
import { AnnouncementsPage } from "@/components/azox/pages/announcements-page";

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "AZOX Announcements — Latest News & Updates" },
      {
        name: "description",
        content:
          "Read the latest AZOX announcements: airdrop news, new games, task drops and community updates.",
      },
      { property: "og:title", content: "AZOX Announcements — Latest News & Updates" },
      {
        property: "og:description",
        content: "Latest AZOX news, airdrop updates and new task drops.",
      },
    ],
  }),
  component: AnnouncementsPage,
});
