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

// Fallback only. The live metadata.url is always window.location.origin
// (appkit-runtime.tsx is browser-only), so this value is never used at
// runtime; it is kept in sync with the published origin for clarity.
export const APP_URL = "https://crypto-task-spark.lovable.app";

// The real Telegram bot link. No app short name is invented here: only the
// bot URL that is known to exist. Used as the WalletConnect return target when
// the app is actually running inside Telegram.
export const TELEGRAM_BOT_URL = "https://t.me/AZOX_Airdrop_bot";

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
