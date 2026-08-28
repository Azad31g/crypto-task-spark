import { createFileRoute } from "@tanstack/react-router";
import { AirdropPage } from "@/components/azox/pages/airdrop-page";

export const Route = createFileRoute("/airdrop")({
  head: () => ({
    meta: [
      { title: "AZOX Airdrop — Register Your Wallet" },
      {
        name: "description",
        content:
          "Register your wallet once to qualify for the AZOX token distribution on Robinhood Chain.",
      },
      { property: "og:title", content: "AZOX Airdrop — Register Your Wallet" },
      {
        property: "og:description",
        content: "Register once to qualify for AZOX token distribution.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AirdropPage,
});
