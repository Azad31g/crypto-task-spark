// BROWSER-ONLY module. Both @reown/appkit/react (Lit web components →
// HTMLElement) and @reown/appkit-adapter-wagmi (AbortController at module
// scope) crash the Cloudflare Workers SSR runtime, so this module must never
// enter the server import graph. It is loaded lazily behind <ClientOnly>.
//
// This is the SINGLE authoritative WagmiAdapter of the app. `wagmi-config.ts`
// only exports chain metadata plus a connector-free, read-only config used
// during SSR — it must never create an adapter.
//
// AppKit/WalletConnect is fully responsible for building wallet launch URLs.
// The Telegram bridge below only transports them; it never inspects, rewrites
// or re-encodes a WalletConnect URI, and it knows nothing about any wallet.
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AppKitButton, createAppKit } from "@reown/appkit/react";
import { networks, projectId, APP_URL, TELEGRAM_APP_URL } from "./wagmi-config";

// --- Telegram Mini App support -------------------------------------------
// Telegram's WebView does not implement window.open(): AppKit's deep link
// silently no-ops, so the WalletConnect session is created but the wallet
// never opens. Route link opening through the Telegram WebApp API instead.
// Must run BEFORE createAppKit().
type TgWebApp = {
  openLink?: (url: string, opts?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
};

function patchTelegramWindowOpen() {
  if (typeof window === "undefined") return;
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram
    ?.WebApp;
  if (!tg) return;
  // Capture the original native window.open BEFORE replacing it. Every wallet
  // launch URL that is not a Telegram link must pass through unchanged — AppKit
  // builds these URLs; the bridge only transports them. Never inspect, decode
  // or rewrite the URL, and never route it through Telegram.WebApp.openLink().
  const nativeOpen = window.open.bind(window);
  window.open = ((url?: string | URL, ...rest: unknown[]) => {
    const href = String(url ?? "");
    if (href.startsWith("https://t.me") || href.startsWith("tg://")) {
      tg.openTelegramLink?.(href);
      return null;
    }
    // HTTPS wallet universal links, http(s):// URLs, metamask://, trust://,
    // cbwallet://, phantom://, WalletConnect URLs and any other wallet URL.
    return nativeOpen(href, ...(rest as Parameters<typeof nativeOpen>));
  }) as typeof window.open;
}

patchTelegramWindowOpen();

// Module scope, exactly once — not inside a React component or useEffect.
// cookieStorage keeps the WalletConnect session recoverable in the Telegram
// WebView, where localStorage can be wiped when the Mini App is re-opened
// after the wallet redirect.
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
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
    // Published origin — must match the deployed app, not a preview URL.
    url: APP_URL,
    icons: [`${APP_URL}/favicon.png`],
    // WalletConnect honours metadata.redirect at session proposal time (it
    // tells the wallet where to send the user back after approval). It is
    // missing from AppKit's Metadata type in this version, hence the cast.
    ...({
      redirect: { native: "", universal: TELEGRAM_APP_URL || APP_URL },
    } as Record<string, unknown>),
  },
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
