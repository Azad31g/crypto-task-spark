// BROWSER-ONLY module. Both @reown/appkit/react (Lit web components →
// HTMLElement) and @reown/appkit-adapter-wagmi (AbortController at module
// scope) crash the Cloudflare Workers SSR runtime, so this module must never
// enter the server import graph. It is loaded lazily behind <ClientOnly>.
//
// This is the SINGLE authoritative WagmiAdapter of the app. `wagmi-config.ts`
// only exports chain metadata plus a connector-free, read-only config used
// during SSR — it must never create an adapter.
import type { ReactNode } from "react";
import { WagmiProvider, createStorage, noopStorage } from "wagmi";
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
// Restored from the pre-backend baseline (commit 36b9149), which is the last
// state where wallet launch worked inside Telegram:
//   * t.me / tg://      -> Telegram.WebApp.openTelegramLink
//   * any other http(s) -> Telegram.WebApp.openLink  (leaves the WebView, so a
//                          wallet HTTPS universal link reaches the wallet app)
//   * custom schemes    -> location.href fallback (openLink only accepts
//                          http/https, so it must never receive metamask://)
// Outside Telegram nothing is intercepted: native window.open is used, which
// keeps AppKit/WalletConnect fully in charge in normal browsers.
type TgWebApp = {
  openLink?: (url: string, opts?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
};

function isTelegramAndroid() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  const inTelegram =
    Boolean(w["Telegram"]) ||
    Boolean(w["TelegramWebviewProxy"]) ||
    Boolean(w["TelegramWebviewProxyProto"]);
  const ua = navigator.userAgent.toLowerCase();
  return inTelegram && ua.includes("android");
}

const IS_TELEGRAM_ANDROID = isTelegramAndroid();

// Best-effort, non-sensitive: the wallet AppKit persisted as the deep-link
// choice. Never contains the WalletConnect URI.
function readSelectedWalletName(): string | undefined {
  try {
    const raw = window.localStorage?.getItem("WALLETCONNECT_DEEPLINK_CHOICE");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { name?: string };
    return parsed?.name;
  } catch {
    return undefined;
  }
}

function patchTelegramWindowOpen() {
  if (typeof window === "undefined") return;
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram
    ?.WebApp;
  const nativeOpen = window.open.bind(window);
  // Not inside Telegram: keep the browser's native behaviour untouched.
  if (!tg) return;

  window.open = ((...args: Parameters<typeof window.open>) => {
    const href = String(args[0] ?? "");
    const isHttp = href.startsWith("https://") || href.startsWith("http://");
    const isTelegramLink = href.startsWith("https://t.me") || href.startsWith("tg://");
    // Diagnostics only — never log the WalletConnect URI itself.
    console.info("[wallet-launch]", {
      wallet: readSelectedWalletName(),
      scheme: href.split(":")[0]?.slice(0, 24) ?? "",
      launch: isTelegramLink ? "telegram" : isHttp ? "universal" : "native",
      telegramAndroid: IS_TELEGRAM_ANDROID,
    });

    try {
      if (isTelegramLink && tg.openTelegramLink) {
        tg.openTelegramLink(href);
        return null;
      }
      if (isHttp && tg.openLink) {
        // Hands the HTTPS universal link to Telegram/OS, which escapes the
        // Mini App WebView — this is what avoids ERR_UNKNOWN_URL_SCHEME.
        tg.openLink(href);
        return null;
      }
      if (!isHttp && href) {
        // Custom wallet scheme with no universal link available.
        window.location.href = href;
        return null;
      }
    } catch (err) {
      console.warn("[wallet-launch] telegram open failed, using native", err);
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
    // Must match the origin actually serving the Mini App (verified at runtime).
    url: RUNTIME_APP_URL,
    icons: [`${RUNTIME_APP_URL}/favicon.png`],
    // WalletConnect honours metadata.redirect at runtime (it tells the wallet
    // where to send the user back after approval). It is missing from AppKit's
    // Metadata type in this version, hence the cast.
    ...({
      redirect: { native: "", universal: TELEGRAM_APP_URL || RUNTIME_APP_URL },
    } as Record<string, unknown>),
  },
  // Telegram's Android WebView cannot resolve wallet custom schemes
  // (metamask://, trust:// …) and fails with net::ERR_UNKNOWN_URL_SCHEME.
  // AppKit's built-in option makes it open each selected wallet's HTTPS
  // universal link (registry `link_mode`) whenever one exists — for the whole
  // WalletConnect wallet list, not just one wallet. Normal browsers keep the
  // default native-scheme behaviour.
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
