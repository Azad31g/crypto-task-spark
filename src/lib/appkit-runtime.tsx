// BROWSER-ONLY module. Both @reown/appkit/react (Lit web components →
// HTMLElement) and @reown/appkit-adapter-wagmi (AbortController at module
// scope) crash the Cloudflare Workers SSR runtime, so this module must never
// enter the server import graph. It is loaded lazily behind <ClientOnly>.
//
// This is the SINGLE authoritative WagmiAdapter of the app. `wagmi-config.ts`
// only exports chain metadata plus a connector-free, read-only config used
// during SSR — it must never create an adapter.
//
// NO window.open monkey-patch lives here. @reown/appkit 1.8.x has first-class
// Telegram Mini App support: CoreHelperUtil.isTelegram() forces the `_blank`
// open target, double-encodes the WalletConnect URI for Telegram Android, and
// `experimental_preferUniversalLinks` makes it launch each wallet's registry
// HTTPS universal link instead of a custom scheme. Navigating the Telegram
// WebView to metamask:// / trust:// / okx:// is exactly what produced
// net::ERR_UNKNOWN_URL_SCHEME, so wallet launching is left entirely to AppKit.
import type { ReactNode } from "react";
import { WagmiProvider, createStorage, noopStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AppKitButton, createAppKit } from "@reown/appkit/react";
import { networks, projectId, APP_URL, TELEGRAM_BOT_URL } from "./wagmi-config";

// The origin Telegram actually launched the Mini App from. This module is
// browser-only, so window.location.origin is always the real serving origin —
// wallets validate metadata.url against it, so never hardcode a guess. The
// build-time APP_URL stays as the fallback only.
const RUNTIME_APP_URL =
  typeof window !== "undefined" ? window.location.origin : APP_URL;

function isTelegram() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return (
    Boolean(w["Telegram"]) ||
    Boolean(w["TelegramWebviewProxy"]) ||
    Boolean(w["TelegramWebviewProxyProto"])
  );
}

const IS_TELEGRAM = isTelegram();

if (typeof window !== "undefined") {
  const webApp = (
    window as unknown as { Telegram?: { WebApp?: Record<string, unknown> } }
  ).Telegram?.WebApp;
  console.info("[appkit-runtime] environment", {
    isTelegram: IS_TELEGRAM,
    platform: webApp?.["platform"],
    href: window.location.href,
  });
}

// Module scope, exactly once — not inside a React component or useEffect.
// Explicit localStorage persistence survives the Telegram Android cold
// relaunch after wallet approval; it is what reconnectOnMount reads on the
// way back in.
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  storage: createStorage({
    storage:
      typeof window !== "undefined" && window.localStorage
        ? window.localStorage
        : noopStorage,
  }),
});

createAppKit({
  // Type-only mismatch under exactOptionalPropertyTypes (optional `namespace`).
  // Runtime value stays the real WagmiAdapter so connectors register correctly.
  // @ts-expect-error -- see above
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: "AZOX Gateway",
    description: "AZOX Gaming Hub",
    // Must match the origin actually serving the app (verified at runtime).
    url: RUNTIME_APP_URL,
    icons: [`${RUNTIME_APP_URL}/favicon.png`],
    // WalletConnect honours metadata.redirect at runtime: it tells the wallet
    // where to send the user back after approval. Inside Telegram that is the
    // real bot link; everywhere else it is the serving origin. Missing from
    // AppKit's Metadata type in this version, hence the cast.
    ...({
      redirect: {
        native: "",
        universal: IS_TELEGRAM ? TELEGRAM_BOT_URL : RUNTIME_APP_URL,
      },
    } as Record<string, unknown>),
  },
  // Official AppKit option: inside Telegram, launch each wallet's registry
  // HTTPS universal link (link_mode) instead of its custom scheme, for the
  // whole WalletConnect wallet list. Normal browsers keep native schemes.
  experimental_preferUniversalLinks: IS_TELEGRAM,
  features: { analytics: false },
});

export function AppKitWagmiProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} reconnectOnMount>
      {children}
    </WagmiProvider>
  );
}

export function WalletButton({ balance }: { balance?: "hide" | "show" }) {
  return <AppKitButton {...(balance ? { balance } : {})} />;
}
