// TEMPORARY diagnostics component. Renders nothing, observes only.
import { useEffect, useRef } from "react";
import { useAccount, useConfig } from "wagmi";
import {
  AZOX_WC_DIAGNOSTICS,
  diag,
  storageKeySnapshot,
  wagmiSnapshot,
} from "@/lib/wc-diagnostics";

export function WcDiagnosticsProbe() {
  const account = useAccount();
  const config = useConfig();
  const last = useRef<string>("");

  useEffect(() => {
    if (!AZOX_WC_DIAGNOSTICS) return;
    const payload = {
      isConnected: account.isConnected,
      status: account.status,
      chainId: account.chainId ?? null,
      accountCount: account.addresses?.length ?? (account.address ? 1 : 0),
      connectorId: account.connector?.id ?? null,
    };
    const key = JSON.stringify(payload);
    if (key === last.current) return;
    last.current = key;
    diag("useAccount changed", payload);
    diag("wagmi state", {
      ...wagmiSnapshot(config),
      storage: storageKeySnapshot(),
    });
  }, [
    account.isConnected,
    account.status,
    account.chainId,
    account.address,
    account.addresses,
    account.connector,
    config,
  ]);

  return null;
}
