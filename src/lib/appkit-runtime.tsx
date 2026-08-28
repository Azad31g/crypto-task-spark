// BROWSER-ONLY module. Both @reown/appkit/react (Lit web components →
// HTMLElement) and @reown/appkit-adapter-wagmi (AbortController at module
// scope) crash the Cloudflare Workers SSR runtime, so this module must never
// enter the server import graph. It is loaded lazily behind <ClientOnly>.
//
// This is the SINGLE authoritative WagmiAdapter of the app. `wagmi-config.ts`
// only exports chain metadata plus a connector-free, read-only config used
// during SSR — it must never create an adapter.
//
// Telegram handling is deliberately limited to genuine Telegram links.
// Wallet and WalletConnect URLs always retain AppKit's native window.open path.
import type { ReactNode } from "react";
import { WagmiProvider, createStorage, noopStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AppKitButton, createAppKit } from "@reown/appkit/react";
import { networks, projectId, APP_URL, TELEGRAM_BOT_URL } from "./wagmi-config";
import { isTelegramMiniApp } from "./telegram";

// The origin Telegram actually launched the Mini App from. This module is
// browser-only, so window.location.origin is always the real serving origin —
// wallets validate metadata.url against it, so never hardcode a guess. The
// build-time APP_URL stays as the fallback only.
const RUNTIME_APP_URL =
  typeof window !== "undefined" ? window.location.origin : APP_URL;

// telegram-web-app.js is loaded on every page, so `window.Telegram` exists in
// ordinary browsers too. Only a real Mini App session carries initData / a
// user object (and a known platform), so detect on those instead.
const IS_TELEGRAM = isTelegramMiniApp();

type TelegramLinkApi = {
  openTelegramLink?: (url: string) => void;
};

function isTelegramUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "tg:" ||
      (url.protocol === "https:" &&
        (url.hostname === "t.me" || url.hostname.endsWith(".t.me")))
    );
  } catch {
    return false;
  }
}

function preserveNativeWalletLaunches(): void {
  if (typeof window === "undefined") return;

  const nativeOpen = window.open.bind(window);
  window.open = ((...args: Parameters<typeof window.open>) => {
    const url = String(args[0] ?? "");
    const webApp = (
      window as unknown as { Telegram?: { WebApp?: TelegramLinkApi } }
    ).Telegram?.WebApp;

    if (webApp?.openTelegramLink && isTelegramUrl(url)) {
      try {
        webApp.openTelegramLink(url);
        return null;
      } catch {
        return nativeOpen(...args);
      }
    }

    return nativeOpen(...args);
  }) as typeof window.open;
}

preserveNativeWalletLaunches();

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
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig}
      reconnectOnMount={!IS_TELEGRAM}
    >
      {children}
    </WagmiProvider>
  );
}

export function WalletButton({ balance }: { balance?: "hide" | "show" }) {
  return <AppKitButton {...(balance ? { balance } : {})} />;
}
