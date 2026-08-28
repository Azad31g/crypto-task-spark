import { createFileRoute } from "@tanstack/react-router";
import { ReferralsPage } from "@/components/azox/pages/referrals-page";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "My AZOX Referrals — Invited Friends" },
      {
        name: "description",
        content:
          "See every friend who joined AZOX through your referral link and the bonus points you earned.",
      },
      { property: "og:title", content: "My AZOX Referrals — Invited Friends" },
      {
        property: "og:description",
        content: "Friends who joined AZOX through your link and your referral rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralsPage,
});
