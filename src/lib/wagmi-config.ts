import { defineChain } from "viem";
import { createConfig, http, type Config } from "wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

// WalletConnect / Reown Project IDs are publishable client identifiers.
export const projectId = "be9bcbf74fc2ea216bd558ee88a70feb";

// Production origin used as AppKit/WalletConnect metadata.url. Wallets show
// this to the user and validate it against the requesting origin — it must be
// the deployed app, never a Lovable preview URL.
export const APP_URL = "https://ear-magic-sparkkk.lovable.app";

// Telegram Mini App link (https://t.me/<bot>/<app>). Used as the WalletConnect
// return target so the wallet sends the user back into Telegram after
// approving. Leave empty until the real bot link is known — never guess one.
export const TELEGRAM_APP_URL = "https://t.me/AZOX_Airdrop_bot?startapp";

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  robinhoodTestnet,
];

// SSR-safe, read-only wagmi config. It contains no connectors and imports
// nothing from @reown/appkit-adapter-wagmi (that package performs disallowed
// operations in Cloudflare Workers global scope). The real AppKit adapter
// config takes over in the browser via `appkit-runtime.tsx`.
// Built lazily: the Workers runtime forbids I/O in module scope.
let ssrConfig: Config | undefined;

export function getSsrWagmiConfig(): Config {
  if (!ssrConfig) {
    ssrConfig = createConfig({
      chains: [robinhoodTestnet],
      transports: {
        [robinhoodTestnet.id]: http(robinhoodTestnet.rpcUrls.default.http[0]),
      },
      ssr: true,
    });
  }
  return ssrConfig;
}
