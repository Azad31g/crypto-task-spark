// BROWSER-ONLY module. Both @reown/appkit/react (Lit web components →
// HTMLElement) and @reown/appkit-adapter-wagmi (AbortController at module
// scope) crash the Cloudflare Workers SSR runtime, so this module must never
// enter the server import graph. It is loaded lazily behind <ClientOnly>.
//
// This is the SINGLE authoritative WagmiAdapter of the app. `wagmi-config.ts`
// only exports chain metadata plus a connector-free, read-only config used
// during SSR — it must never create an adapter.
//
// AppKit/WalletConnect stays fully responsible for launching wallets: no URL
// is rewritten, mapped, or routed through Telegram APIs. Only genuine
// Telegram links are intercepted.
import type { ReactNode } from "react";
import { WagmiProvider, createStorage, noopStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AppKitButton, createAppKit } from "@reown/appkit/react";
import { networks, projectId, APP_URL } from "./wagmi-config";
import { isTelegramMiniApp } from "./telegram";

// The origin actually serving the app. Wallets validate metadata.url against
// it, so never hardcode a guess; APP_URL is only an SSR-time fallback.
const RUNTIME_APP_URL =
  typeof window !== "undefined" ? window.location.origin : APP_URL;

function detectTelegramAndroid(): boolean {
  if (typeof window === "undefined") return false;
  if (!isTelegramMiniApp()) return false;
  return navigator.userAgent.toLowerCase().includes("android");
}

const IS_TELEGRAM_ANDROID = detectTelegramAndroid();

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

// Wallet, WalletConnect and universal links always keep the native
// window.open path — unchanged arguments, no logging of URIs.
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
      } catch (error) {
        console.error("[appkit-runtime] failed to open telegram link", error);
      }
    }

    return nativeOpen(...args);
  }) as typeof window.open;
}

preserveNativeWalletLaunches();

// Module scope, exactly once — not inside a React component or useEffect.
// Explicit localStorage persistence survives the Telegram Android cold
// relaunch after wallet approval; it is what reconnectOnMount reads on the
// way back in. cookieStorage is deliberately NOT used (it needs the SSR
// cookieToInitialState handshake an ssr:false adapter cannot provide).
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
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
  },
  // Telegram's Android WebView cannot resolve wallet custom schemes, so ask
  // AppKit to prefer each wallet's registry HTTPS universal link there only.
  // Normal browsers keep AppKit's default behaviour untouched.
  experimental_preferUniversalLinks: IS_TELEGRAM_ANDROID,
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
