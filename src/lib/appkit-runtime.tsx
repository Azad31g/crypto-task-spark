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
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider, createStorage, noopStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AppKitButton, createAppKit } from "@reown/appkit/react";
import { networks, projectId, APP_URL, TELEGRAM_APP_URL } from "./wagmi-config";
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
  openLink?: (url: string) => void;
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

// @reown/appkit-controllers 1.8.23 CoreHelperUtil.formatNativeUrl()
// double-encodes the WalletConnect URI on Telegram Android, producing
// `<wallet-universal-link>/wc?uri=wc%253A...`. The wallet then receives a
// still-encoded `wc%3A...` value it cannot parse, so it opens without any
// Connect request. Repair only that case: HTTPS launch URL (never tg:/t.me)
// whose `uri` param decodes once more into a valid `wc:` URI.
function repairDoubleEncodedWcUri(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || isTelegramUrl(value)) return null;

  const uriParam = url.searchParams.get("uri"); // already decoded once
  if (!uriParam || uriParam.startsWith("wc:")) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(uriParam);
  } catch {
    return null;
  }
  if (!decoded.startsWith("wc:")) return null;

  // Single-encoding via searchParams.set() restores a valid WC URI while
  // leaving every other query parameter byte-identical.
  url.searchParams.set("uri", decoded);
  return url.toString();
}

// Inside a Telegram Mini App, the WebView cannot resolve wallet launches on
// its own: HTTP(S) universal links must go through Telegram.WebApp.openLink()
// (the working baseline behaviour) and genuine Telegram links through
// openTelegramLink(). Custom wallet schemes (metamask://, trust://, ...) are
// handed to openLink() too, with a native window.open() fallback. Outside
// Telegram, window.open is left completely untouched.
function preserveNativeWalletLaunches(): void {
  if (typeof window === "undefined") return;

  const nativeOpen = window.open.bind(window);
  window.open = ((...args: Parameters<typeof window.open>) => {
    const url = String(args[0] ?? "");
    const webApp = (
      window as unknown as { Telegram?: { WebApp?: TelegramLinkApi } }
    ).Telegram?.WebApp;

    if (!webApp || !isTelegramMiniApp()) {
      return nativeOpen(...args);
    }

    if (webApp.openTelegramLink && isTelegramUrl(url)) {
      try {
        webApp.openTelegramLink(url);
        return null;
      } catch (error) {
        console.error("[appkit-runtime] failed to open telegram link", error);
      }
    }

    // Repair AppKit 1.8.23's double-encoded `uri` param before launching.
    const target = repairDoubleEncodedWcUri(url) ?? url;
    const isHttp = /^https?:/i.test(target);

    // Baseline (36b9149) behaviour: HTTP(S) universal links go through
    // Telegram.openLink (this is what makes Android wallet launches work),
    // while custom wallet schemes (metamask://, trust://, …) are navigated
    // directly — Telegram.openLink cannot resolve them and produces
    // ERR_UNKNOWN_URL_SCHEME. No wallet-name mapping is involved.
    if (isHttp && webApp.openLink) {
      try {
        // Redacted diagnostics: schemes/flags only, never the WC URI.
        console.debug("[appkit-runtime] wallet launch via Telegram.openLink", {
          scheme: target.split(":")[0],
          repaired: target !== url,
        });
        webApp.openLink(target);
        return null;
      } catch (error) {
        console.error("[appkit-runtime] openLink failed, using native", error);
      }
    }

    if (!isHttp) {
      try {
        console.debug("[appkit-runtime] wallet launch via location.href", {
          scheme: target.split(":")[0],
        });
        window.location.href = target;
        return null;
      } catch (error) {
        console.error("[appkit-runtime] scheme navigation failed", error);
      }
    }

    return nativeOpen(target, args[1], args[2]);
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

const REDIRECT = { native: "", universal: TELEGRAM_APP_URL };

const appkit = createAppKit({
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
    // WalletConnect honours metadata.redirect at session proposal time: it tells
    // the wallet where to send the user back after approval, so the pending
    // WalletConnect session can settle while the Mini App is still alive.
    // AppKit 1.8.23's Metadata type omits this field, hence the cast.
    ...({ redirect: REDIRECT } as Record<string, unknown>),
  },
  // Telegram's Android WebView cannot resolve wallet custom schemes, so ask
  // AppKit to prefer each wallet's registry HTTPS universal link there only.
  // Normal browsers keep AppKit's default behaviour untouched.
  experimental_preferUniversalLinks: IS_TELEGRAM_ANDROID,
  features: { analytics: false },
});

// AppKit 1.8.23's initializeUniversalAdapter() rebuilds metadata as
// { name, description, url, icons } before initialising UniversalProvider,
// silently dropping `redirect`. The SignClient therefore never learns the
// return URL, so the wallet keeps the user and the Mini App session never
// settles. Re-inject redirect onto the SignClient's metadata after init so
// the next session proposal carries it. populateAppMetadata() (called during
// SignClient init) preserves any field it receives, so this survives.
export const walletConnectReady: Promise<void> = appkit
  .getUniversalProvider()
  .then((provider) => {
    const client = provider?.client as
      | { metadata?: Record<string, unknown> }
      | undefined;
    if (client?.metadata) {
      client.metadata = { ...client.metadata, redirect: REDIRECT };
    }
  })
  .catch((error) => {
    console.error("[appkit-runtime] failed to inject WC redirect", error);
  });

export function AppKitWagmiProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} reconnectOnMount>
      {children}
    </WagmiProvider>
  );
}

// The Connect entry point stays disabled until the UniversalProvider is
// initialised and `redirect` has been re-injected into the SignClient
// metadata — otherwise a very early tap could open a session proposal without
// the Telegram return URL (race condition).
export function WalletButton({ balance }: { balance?: "hide" | "show" }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void walletConnectReady.then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <button
        disabled
        className="w-full rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
      >
        Preparing wallet…
      </button>
    );
  }

  return <AppKitButton {...(balance ? { balance } : {})} />;
}
