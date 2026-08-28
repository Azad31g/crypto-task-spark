import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/azox/pages/home-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AZOX — Tap to Earn on Robinhood Chain" },
      {
        name: "description",
        content:
          "Tap, play mini games and climb 7 global ranks to earn AZOX points on Robinhood Chain.",
      },
      { property: "og:title", content: "AZOX — Tap to Earn on Robinhood Chain" },
      {
        property: "og:description",
        content:
          "Tap, play mini games and climb 7 global ranks to earn AZOX points.",
      },
    ],
  }),
  component: HomePage,
});
