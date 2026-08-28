import { createFileRoute } from "@tanstack/react-router";
import { GamingPage } from "@/components/azox/pages/gaming-page";

export const Route = createFileRoute("/gaming")({
  head: () => ({
    meta: [
      { title: "AZOX Gaming — Mini Games Hub" },
      {
        name: "description",
        content:
          "Browse the AZOX mini game hub: Global Button, Azox Word, Snake, Shoot, Box and more.",
      },
      { property: "og:title", content: "AZOX Gaming — Mini Games Hub" },
      {
        property: "og:description",
        content: "Browse the AZOX mini game hub and earn points playing.",
      },
    ],
  }),
  component: GamingPage,
});
