// BROWSER-ONLY module. Both @reown/appkit/react (Lit web components →
// HTMLElement) and @reown/appkit-adapter-wagmi (AbortController at module
// scope) crash the Cloudflare Workers SSR runtime, so this module must never
// enter the server import graph. It is loaded lazily behind <ClientOnly>.
//
// Restored from the verified August 19 reference (ear-magic-sparkkk@67bc341):
// ONE WagmiAdapter, ONE createAppKit(), ONE browser WagmiProvider,
// cookieStorage, and the original Telegram window.open bridge.
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AppKitButton, createAppKit } from "@reown/appkit/react";
import { networks, projectId, APP_URL, TELEGRAM_APP_URL } from "./wagmi-config";

// --- Telegram Mini App support -------------------------------------------
// Telegram's WebView does not implement window.open(); route link opening
// through the Telegram WebApp API. Must run BEFORE createAppKit().
type TgWebApp = {
  openLink?: (url: string, opts?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
};

function patchTelegramWindowOpen() {
  if (typeof window === "undefined") return;
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  if (!tg) return;
  const nativeOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const href = String(url ?? "");
    if (href.startsWith("https://t.me") || href.startsWith("tg://")) {
      tg.openTelegramLink?.(href);
      return null;
    }
    if (href.startsWith("http")) {
      tg.openLink?.(href);
      return null;
    }
    // Custom wallet schemes (metamask://wc?uri=…, trust://…): never navigate
    // the WebView itself (net::ERR_UNKNOWN_URL_SCHEME). Hand them to the
    // native window.open with AppKit's own "_blank" target so Telegram
    // Android dispatches them to the wallet app as an external intent.
    return nativeOpen(href, target ?? "_blank", features);
  }) as typeof window.open;
}

patchTelegramWindowOpen();

// Module scope, exactly once. cookieStorage keeps the WalletConnect session
// recoverable in the Telegram WebView.
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

createAppKit({
  // Type-only mismatch under exactOptionalPropertyTypes (optional `namespace`).
  // @ts-expect-error -- see above
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: "AZOX Gateway",
    description: "AZOX Gaming Hub",
    url: APP_URL,
    icons: [`${APP_URL}/favicon.png`],
    // Honoured by WalletConnect at runtime; missing from AppKit's Metadata type.
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
