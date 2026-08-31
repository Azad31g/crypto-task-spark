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
import { cookieStorage, createStorage, type CreateConnectorFn } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AppKitButton, createAppKit } from "@reown/appkit/react";
import UniversalProvider from "@walletconnect/universal-provider";
import { networks, projectId, APP_URL, TELEGRAM_APP_URL } from "./wagmi-config";
import { isTelegramAndroidMiniApp } from "./azox-wallet-layer";
import { metaMaskConnect } from "./metamask-connect-connector";

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
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  if (!tg) return;
  // Capture the original native window.open BEFORE replacing it. Every wallet
  // launch URL that is not a Telegram link must pass through unchanged — AppKit
  // builds these URLs; the bridge only transports them. Never inspect, decode
  // or rewrite the URL, and never route it through Telegram.WebApp.openLink().
  const nativeOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string): Window | null => {
    const href = String(url ?? "");
    if (href.startsWith("https://t.me") || href.startsWith("tg://")) {
      tg.openTelegramLink?.(href);
      return null;
    }
    // HTTPS wallet universal links, http(s):// URLs, metamask://, trust://,
    // cbwallet://, phantom://, WalletConnect URLs and any other wallet URL.
    return nativeOpen(href, target, features);
  }) as typeof window.open;
}

patchTelegramWindowOpen();

// --- WalletConnect session metadata ---------------------------------------
// AppKit 1.8.23's initializeUniversalAdapter() rebuilds this metadata
// field-by-field (name/description/url/icons only) and DROPS `redirect`
// before calling UniversalProvider.init(). The redirect tells the wallet
// where to return the user after session approval; without it the approved
// session never reaches back into the Telegram Mini App. We therefore create
// the ONE UniversalProvider ourselves — with the full metadata — and hand it
// to createAppKit via its supported `universalProvider` option.
const wcMetadata = {
  name: "AZOX Gateway",
  description: "AZOX Gaming Hub",
  // Published origin — must match the deployed app, not a preview URL.
  url: APP_URL,
  icons: [`${APP_URL}/favicon.png`],
  redirect: {
    native: "",
    universal: TELEGRAM_APP_URL || APP_URL,
  },
};

// Assigned exactly once by the async init below.
let wagmiAdapter: WagmiAdapter | null = null;

// Exactly ONE UniversalProvider, ONE WagmiAdapter, ONE createAppKit — created
// in that order, at module scope (not inside a component or useEffect).
// Consumers suspend on this promise via React `use()`, so nothing renders
// (and no wallet flow can start) before initialization completes.
const appKitReady: Promise<void> = (async () => {
  const universalProvider = await UniversalProvider.init({
    projectId,
    metadata: wcMetadata,
  });

  // cookieStorage keeps the WalletConnect session recoverable in the Telegram
  // WebView, where localStorage can be wiped when the Mini App is re-opened
  // after the wallet redirect. ONE storage instance, shared between the
  // session-recovery write below and the WagmiAdapter.
  const wagmiStorage = createStorage({ storage: cookieStorage });

  // Session recovery (installed-source proven):
  // When Telegram recreates the Mini App page after the wallet approval, the
  // original WalletConnectConnector.connect() promise is lost, so wagmi's
  // `walletConnect.requestedChains` storage entry was never written. On the
  // next load the UniversalProvider restores the REAL settled session, but
  // WalletConnectConnector.isAuthorized() -> isChainsStale() reads an empty
  // requestedChains list, concludes the chains are stale and calls
  // provider.disconnect(), destroying the valid session.
  const restoredSession = universalProvider.session;
  const restoredAccounts = restoredSession?.namespaces?.["eip155"]?.accounts ?? [];
  const restoredChainIds = Array.from(
    new Set(
      restoredAccounts
        .map((account) => Number.parseInt(account.split(":")[1] ?? "", 10))
        .filter((id) => Number.isFinite(id)),
    ),
  );
  if (restoredSession && restoredChainIds.length > 0) {
    await wagmiStorage.setItem("walletConnect.requestedChains", restoredChainIds);
  }

  // Hybrid wallet layer: the official MetaMask Connect wagmi connector is only
  // registered inside a real Telegram Mini App on Android, where MetaMask's own
  // link flow is required. Everywhere else the AppKit/WalletConnect behavior is
  // untouched. Either way there is still exactly ONE WagmiAdapter.
  const extraConnectors: CreateConnectorFn[] = isTelegramAndroidMiniApp()
    ? [metaMaskConnect() as unknown as CreateConnectorFn]
    : [];

  wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: true,
    storage: wagmiStorage,
    ...(extraConnectors.length ? { connectors: extraConnectors } : {}),
  });

  createAppKit({
    // Type-only mismatch under exactOptionalPropertyTypes (optional `namespace`).
    // Runtime value stays the real WagmiAdapter so connectors register correctly.
    // @ts-expect-error -- see above
    adapters: [wagmiAdapter],
    networks,
    projectId,
    // The SAME provider initialized above — its SignClient carries the
    // redirect metadata that AppKit would otherwise strip.
    universalProvider,
    metadata: wcMetadata,
    features: { analytics: false },
  });
})();

export function AppKitWagmiProvider({ children }: { children: ReactNode }) {
  use(appKitReady);
  return (
    <WagmiProvider config={wagmiAdapter!.wagmiConfig} reconnectOnMount>
      {children}
    </WagmiProvider>
  );
}

export function WalletButton({ balance }: { balance?: "hide" | "show" }) {
  use(appKitReady);
  return <AppKitButton {...(balance ? { balance } : {})} />;
}
