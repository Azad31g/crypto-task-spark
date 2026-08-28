import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/azox/pages/about-page";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — AZOX" },
      {
        name: "description",
        content:
          "Learn about AZOX, the Web3 ecosystem on Robinhood Chain, and founder Azad Bashqali.",
      },
      { property: "og:title", content: "About — AZOX" },
      {
        property: "og:description",
        content:
          "Learn about AZOX, the Web3 ecosystem on Robinhood Chain, and founder Azad Bashqali.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});
