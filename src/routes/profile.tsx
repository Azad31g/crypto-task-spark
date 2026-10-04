import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/azox/pages/profile-page";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "AZOX Profile — Stats & Referral Link" },
      {
        name: "description",
        content:
          "Track your AZOX points, rank progress and share your referral link with friends.",
      },
      { property: "og:title", content: "AZOX Profile — Stats & Referral Link" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Your AZOX points, rank progress and referral link.",
      },
    ],
  }),
  component: ProfilePage,
});
