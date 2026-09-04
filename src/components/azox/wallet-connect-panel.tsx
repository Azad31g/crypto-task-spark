import { lazy, Suspense, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";

const ORANGE = "#FF7A18";

const WalletButton = lazy(() =>
  import("@/lib/appkit-runtime").then((m) => ({ default: m.WalletButton })),
);

function Loading() {
  return <span className="text-xs text-muted-foreground">Loading wallet…</span>;
}

/**
 * Single wallet connection entry point: the AppKit button. Every EVM wallet
 * (MetaMask, Trust, Phantom, Coinbase…) connects through the same
 * AppKit/WalletConnect flow — there is no wallet-specific branch.
 */
export function WalletConnectPanel({ footer }: { footer?: ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold" style={{ color: ORANGE }}>
        Connect Your Wallet
      </h2>
      <p className="text-xs text-muted-foreground">
        Supports MetaMask, Trust Wallet, Phantom, Coinbase &amp; more
      </p>
      <span
        className="inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold"
        style={{ color: ORANGE, borderColor: ORANGE }}
      >
        Robinhood Chain Testnet
      </span>

      <div className="flex justify-center">
        <ClientOnly fallback={<Loading />}>
          <Suspense fallback={<Loading />}>
            <WalletButton />
          </Suspense>
        </ClientOnly>
      </div>

      {footer}
    </div>
  );
}
