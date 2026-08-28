// BROWSER-ONLY module. Both @reown/appkit/react (Lit web components →
// HTMLElement) and @reown/appkit-adapter-wagmi (AbortController at module
// scope) crash the Cloudflare Workers SSR runtime, so this module must never
// enter the server import graph. It is loaded lazily behind <ClientOnly>.
//
// This is the SINGLE authoritative WagmiAdapter of the app. `wagmi-config.ts`
// only exports chain metadata plus a connector-free, read-only config used
// during SSR — it must never create an adapter.
import type { ReactNode } from "react";
import { WagmiProvider, createStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AppKitButton, createAppKit } from "@reown/appkit/react";
import { networks, projectId, APP_URL, TELEGRAM_APP_URL } from "./wagmi-config";

// The origin Telegram actually launched the Mini App from. This module is
// browser-only, so window.location.origin is always the real serving origin —
// wallets validate metadata.url against it, so never hardcode a guess. The
// build-time APP_URL stays as the fallback only.
const RUNTIME_APP_URL =
  typeof window !== "undefined" ? window.location.origin : APP_URL;

// --- Telegram Mini App support -------------------------------------------
// ONLY genuine Telegram links (t.me / tg://) are routed through the Telegram
// WebApp API. Every other URL — including all WalletConnect deep links and
// wallet universal links — keeps the original native window.open, so
// AppKit/WalletConnect stays fully in charge of launching wallets.
type TgWebApp = {
  openTelegramLink?: (url: string) => void;
};

function patchTelegramWindowOpen() {
  if (typeof window === "undefined") return;
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram
    ?.WebApp;
  if (!tg?.openTelegramLink) return;
  const nativeOpen = window.open.bind(window);
  window.open = ((...args: Parameters<typeof window.open>) => {
    const href = String(args[0] ?? "");
    if (href.startsWith("https://t.me") || href.startsWith("tg://")) {
      try {
        tg.openTelegramLink!(href);
        return null;
      } catch {
        return nativeOpen(...args);
      }
    }
    return nativeOpen(...args);
  }) as typeof window.open;
}

patchTelegramWindowOpen();

// DIAGNOSTIC: log Telegram environment
if (typeof window !== "undefined") {
  const tg = ((window as unknown) as Record<string, unknown>)?.["Telegram"] as Record<string, unknown> | undefined;
  const webApp = tg?.["WebApp"] as Record<string, unknown> | undefined;
  console.info("[appkit-runtime] environment", {
    isTelegram: Boolean(webApp),
    platform: webApp?.["platform"],
    initData: Boolean(webApp?.["initData"]),
    href: window.location.href,
  });
}

// Module scope, exactly once — not inside a React component or useEffect.
// This module is browser-only (loaded behind <ClientOnly>), so persistence is
// explicit localStorage: it survives the Telegram Android cold-relaunch after
// wallet approval and is what reconnectOnMount reads on the way back in.
// cookieStorage is NOT used: it would require the cookieToInitialState SSR
// hydration handshake, which a client-only (ssr:false) adapter cannot provide,
// and Telegram's in-app webview does not reliably persist cookies either.
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  storage: createStorage({
    key: "azox.wagmi",
    storage:
      typeof window !== "undefined" && window.localStorage
        ? window.localStorage
        : undefined,
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
    // Production origin — must match the deployed app, not a preview URL.
    url: APP_URL,
    icons: [`${APP_URL}/favicon.png`],
    // WalletConnect honours metadata.redirect at runtime (it tells the wallet
    // where to send the user back after approval). It is missing from AppKit's
    // Metadata type in this version, hence the cast.
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
