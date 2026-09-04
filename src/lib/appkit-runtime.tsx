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
import { use, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AppKitButton, createAppKit } from "@reown/appkit/react";
import { UniversalProvider } from "@walletconnect/universal-provider";
import { networks, projectId, APP_URL, TELEGRAM_APP_URL } from "./wagmi-config";

// --- Telegram Mini App support -------------------------------------------
// Telegram's WebView does not implement window.open(): AppKit's launch call
// silently no-ops, so the WalletConnect session is created but the wallet
// never opens. Route link opening through the Telegram WebApp API instead.
// Must run BEFORE AppKit is created.
type TgWebApp = {
  openLink?: (url: string, opts?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
};

function patchTelegramWindowOpen() {
  if (typeof window === "undefined") return;
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  if (!tg) return;
  const nativeOpen = window.open.bind(window);
  window.open = ((url?: string | URL, ...rest: unknown[]): Window | null => {
    const href = String(url ?? "");
    if (href.startsWith("https://t.me") || href.startsWith("tg://")) {
      tg.openTelegramLink?.(href);
      return null;
    }
    if (href.startsWith("http://") || href.startsWith("https://")) {
      // Wallet universal links (AppKit builds them) — never inspected or
      // rewritten. Telegram's own API is the only reliable way to leave the
      // Mini App WebView.
      if (tg.openLink) {
        tg.openLink(href);
        return null;
      }
    }
    // Anything else (including custom wallet schemes) is handed back to the
    // native window.open untouched. The Telegram WebView must never be
    // navigated to a custom scheme — that is what raises
    // net::ERR_UNKNOWN_URL_SCHEME. `experimental_preferUniversalLinks` below
    // keeps AppKit on HTTPS links whenever the wallet publishes one.
    return nativeOpen(href, ...(rest as []));
  }) as typeof window.open;
}

patchTelegramWindowOpen();

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

// AppKit 1.8.23 rebuilds the metadata object it hands to its internally created
// UniversalProvider from name/description/url/icons only, dropping `redirect`
// (see @reown/appkit/dist/esm/src/client/appkit-base-client.js
// `initializeUniversalAdapter`). The Telegram return target therefore only
// reaches WalletConnect when the provider is created here and passed in via the
// supported `universalProvider` option. Exactly ONE provider instance exists and
// AppKit shares it with the single WagmiAdapter.
const runtimeReady = (async () => {
  const universalProvider = await UniversalProvider.init({
    projectId,
    metadata: {
      name: "AZOX Gateway",
      description: "AZOX Gaming Hub",
      url: APP_URL,
      icons: [`${APP_URL}/favicon.png`],
      redirect: {
        native: "",
        universal: TELEGRAM_APP_URL || APP_URL,
      },
    },
  });

  createAppKit({
    // Type-only mismatch under exactOptionalPropertyTypes (optional `namespace`).
    // @ts-expect-error -- see above
    adapters: [wagmiAdapter],
    networks,
    projectId,
    universalProvider,
    // Installed-supported option: prefer the wallet's HTTPS universal link over
    // its custom scheme when both exist. Custom schemes are what Telegram's
    // Android WebView rejects with ERR_UNKNOWN_URL_SCHEME.
    experimental_preferUniversalLinks: true,
    metadata: {
      name: "AZOX Gateway",
      description: "AZOX Gaming Hub",
      url: APP_URL,
      icons: [`${APP_URL}/favicon.png`],
      // `redirect` is honored at runtime by WalletConnect but missing from
      // AppKit's Metadata type.
      redirect: {
        native: "",
        universal: TELEGRAM_APP_URL || APP_URL,
      },
    } as never,
    features: { analytics: false },
  });

  return true;
})();

export function AppKitWagmiProvider({ children }: { children: ReactNode }) {
  // Suspends until the single UniversalProvider + AppKit instance exist, so no
  // second wagmi config can ever mount underneath connected state.
  use(runtimeReady);
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} reconnectOnMount>
      {children}
    </WagmiProvider>
  );
}

export function WalletButton({ balance }: { balance?: "hide" | "show" }) {
  use(runtimeReady);
  return <AppKitButton {...(balance ? { balance } : {})} />;
}
