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
import { startWalletDebug, WalletDebugPanel } from "./wallet-debug";
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

const appKit = createAppKit({
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

// --- Single pending WalletConnect attempt ---------------------------------
// AppKit 1.8.23 already de-duplicates WalletConnect attempts inside Telegram
// via ConnectionController.connectWalletConnect({ cache: "auto" })
// (wcConnectionPromise). But the connecting view calls it with
// { cache: "never" } (w3m-connecting-wc-view initializeConnection), which
// bypasses that guard, so a second call creates a second pairing/proposal
// and the deep link the wallet received no longer matches the attempt the
// Mini App is waiting on. Apply the same single-flight guarantee at the
// client AppKit hands to ConnectionController (same object reference, see
// appkit-base-client createClients → ConnectionController.setClient).
// A new attempt is allowed once AppKit's own pairing window (4 min) passes.
type WcClient = { connectWalletConnect?: () => Promise<void> };
const PAIRING_WINDOW_MS = 4 * 60 * 1000;
const wcClient = (appKit as unknown as { connectionControllerClient?: WcClient })
  .connectionControllerClient;
if (wcClient?.connectWalletConnect) {
  const original = wcClient.connectWalletConnect.bind(wcClient);
  let inFlight: { promise: Promise<void>; startedAt: number } | null = null;
  wcClient.connectWalletConnect = () => {
    if (inFlight && Date.now() - inFlight.startedAt < PAIRING_WINDOW_MS) {
      dbg("wc.connect.deduplicated", { ageMs: Date.now() - inFlight.startedAt, caller: callerTrace() });
      return inFlight.promise;
    }
    dbg("wc.connect.start", { caller: callerTrace() });
    const promise = original().then(
      () => dbg("wc.connect.resolved"),
      (e: unknown) => {
        dbg("wc.connect.rejected", { error: e instanceof Error ? e.message : String(e) });
        throw e;
      },
    );
    const entry = { promise, startedAt: Date.now() };
    inFlight = entry;
    void promise
      .catch(() => {})
      .finally(() => {
        if (inFlight === entry) inFlight = null;
      });
    return promise;
  };
}

// TEMPORARY diagnostics (read-only).
startWalletDebug(appKit, wagmiAdapter.wagmiConfig);


export function AppKitWagmiProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} reconnectOnMount>
      {children}
    </WagmiProvider>
  );
}

export function WalletButton({ balance }: { balance?: "hide" | "show" }) {
  return (
    <>
      <AppKitButton {...(balance ? { balance } : {})} />
      <WalletDebugPanel />
    </>
  );
}
