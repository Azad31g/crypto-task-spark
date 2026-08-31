import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useConnect } from "wagmi";
import {
  METAMASK_CONNECTOR_ID,
  WALLET_MODE_LABELS,
  detectWalletEnvironment,
  openAzoxInExternalBrowser,
  type WalletEnvironment,
} from "@/lib/azox-wallet-layer";
import { robinhoodTestnet } from "@/lib/wagmi-config";

const ORANGE = "#FF7A18";

const WalletButton = lazy(() =>
  import("@/lib/appkit-runtime").then((m) => ({ default: m.WalletButton })),
);

function Loading() {
  return <span className="text-xs text-muted-foreground">Loading wallet…</span>;
}

function AppKitEntry({ balance }: { balance?: "hide" }) {
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <WalletButton {...(balance ? { balance } : {})} />
      </Suspense>
    </ClientOnly>
  );
}

/**
 * Wallet connection entry point. Transport selection lives in the wallet layer;
 * this component only renders the corresponding UI.
 * - web / Telegram non-Android: unchanged AppKit modal.
 * - Telegram Android: explicit "Connect with MetaMask" (official MetaMask
 *   Connect wagmi connector) plus "Other Wallets" (AppKit / WalletConnect),
 *   with a user-initiated browser fallback if MetaMask Connect fails.
 * No transaction is ever sent here — registration stays manual.
 */
export function WalletConnectPanel({ footer }: { footer?: ReactNode }) {
  const [env, setEnv] = useState<WalletEnvironment>("web");
  const { connectAsync, connectors } = useConnect();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnv(detectWalletEnvironment());
  }, []);

  const labels = WALLET_MODE_LABELS[env];
  const isTelegramAndroid = env === "telegram-android";

  const handleMetaMask = async () => {
    const connector = connectors.find((c) => c.id === METAMASK_CONNECTOR_ID);
    if (!connector) {
      setError("MetaMask Connect is not available in this environment.");
      return;
    }
    setError(null);
    setConnecting(true);
    try {
      await connectAsync({ connector, chainId: robinhoodTestnet.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold" style={{ color: ORANGE }}>
        Connect Your Wallet
      </h2>
      <p className="text-xs text-muted-foreground">{labels.hint}</p>
      <span
        className="inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold"
        style={{ color: ORANGE, borderColor: ORANGE }}
      >
        Robinhood Chain Testnet
      </span>

      {isTelegramAndroid ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleMetaMask}
            disabled={connecting}
            className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: ORANGE }}
          >
            {connecting ? "Connecting…" : `🦊 ${labels.primary}`}
          </button>

          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {labels.secondary} (Trust, Coinbase, Phantom…)
            </span>
            <AppKitEntry />
          </div>

          {error && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-[11px] text-destructive">{error}</p>
              <p className="text-[11px] text-muted-foreground">
                Fallback: open AZOX in your phone browser and connect there.
              </p>
              <button
                type="button"
                onClick={openAzoxInExternalBrowser}
                className="w-full rounded-xl border border-border py-2 text-xs font-semibold"
              >
                🌐 Open AZOX in Browser
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex justify-center">
          <AppKitEntry />
        </div>
      )}

      {footer}
    </div>
  );
}
