// TEMPORARY diagnostics for the Telegram Android session-settlement bug.
// Read-only: observes AppKit / WalletConnect / Wagmi state, never changes it.
// Logs only non-sensitive data (no URIs, keys, signatures, tokens).
// Remove once the root case (A/B/C) is identified.
import { useEffect, useState } from "react";
import { getAccount, getConnections, watchAccount, type Config } from "@wagmi/core";

const PREFIX = "[AZOX-WALLET-DEBUG]";
const lines: string[] = [];
const subs = new Set<() => void>();

export function dbg(msg: string, data?: unknown) {
  let s = "";
  try {
    s = data === undefined ? "" : " " + JSON.stringify(data);
  } catch {
    s = " [unserializable]";
  }
  const line = `${new Date().toISOString().slice(11, 23)} ${msg}${s}`;
  console.log(PREFIX, line);
  lines.push(line);
  if (lines.length > 300) lines.shift();
  subs.forEach((f) => f());
}

type WcSession = {
  topic?: string;
  namespaces?: Record<string, { accounts?: string[]; chains?: string[] }>;
  peer?: { metadata?: { name?: string } };
};
type UP = {
  session?: WcSession;
  on: (e: string, cb: (...a: unknown[]) => void) => void;
};

function sessionSummary(s?: WcSession) {
  if (!s) return null;
  return {
    topic: s.topic ? s.topic.slice(0, 8) + "…" : null,
    peer: s.peer?.metadata?.name ?? null,
    namespaces: Object.fromEntries(
      Object.entries(s.namespaces ?? {}).map(([k, v]) => [
        k,
        { accounts: v.accounts, chains: v.chains },
      ]),
    ),
  };
}

function wagmiSummary(config: Config) {
  const a = getAccount(config);
  return {
    status: a.status,
    isConnected: a.isConnected,
    address: a.address ?? null,
    chainId: a.chainId ?? null,
    connector: a.connector?.id ?? null,
    connections: getConnections(config).map((c) => ({
      id: c.connector.id,
      accounts: c.accounts,
      chainId: c.chainId,
    })),
  };
}

function storageSnapshot() {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (
        /wagmi|walletConnect|@appkit|recentConnector|requestedChains|connected/i.test(k) &&
        !/wc@2:core|keychain|crypto/i.test(k)
      ) {
        out[k] = String(localStorage.getItem(k)).slice(0, 120);
      }
    }
  } catch (e) {
    out["localStorage"] = "unavailable: " + String(e);
  }
  out["cookieKeys"] = document.cookie
    .split(";")
    .map((c) => c.split("=")[0]!.trim())
    .filter((k) => /wagmi|walletConnect|recentConnector/i.test(k))
    .join(",");
  out["wcSessionKeyPresent"] = String(
    Object.keys(localStorage).some((k) => k.includes("wc@2:client") && k.includes("session")),
  );
  return out;
}

export function startWalletDebug(
  appKit: { getUniversalProvider?: () => Promise<unknown> },
  config: Config,
) {
  if (typeof window === "undefined") return;
  const tg = (
    window as unknown as { Telegram?: { WebApp?: { platform?: string; version?: string } } }
  ).Telegram?.WebApp;
  dbg("boot", {
    href: location.pathname + location.search.slice(0, 40),
    tgPlatform: tg?.platform ?? null,
    tgVersion: tg?.version ?? null,
    navType:
      (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)
        ?.type ?? null,
  });
  dbg("storage@boot", storageSnapshot());
  dbg("wagmi@boot", wagmiSummary(config));

  watchAccount(config, { onChange: () => dbg("wagmi.change", wagmiSummary(config)) });
  config.subscribe(
    (s) => s.status,
    (st) => dbg("wagmi.status", st),
  );

  for (const ev of ["visibilitychange", "pageshow", "pagehide", "focus"] as const) {
    window.addEventListener(ev, () => {
      dbg(`lifecycle.${ev}`, { visibility: document.visibilityState });
      if (ev !== "pagehide") {
        void appKit
          .getUniversalProvider?.()
          .then((p) => dbg("wc.session@" + ev, sessionSummary((p as UP | undefined)?.session)));
        dbg("wagmi@" + ev, wagmiSummary(config));
      }
    });
  }

  const ready = (appKit as { ready?: () => Promise<void> }).ready?.() ?? Promise.resolve();
  void ready
    .then(async () => {
      dbg("appkit.ready");
      const p = (await appKit.getUniversalProvider?.()) as UP | undefined;
      dbg("wc.provider", { available: Boolean(p) });
      if (!p) return;
      dbg("wc.session@ready", sessionSummary(p.session));
      dbg("wagmi@ready", wagmiSummary(config));
      dbg(
        "connectors",
        config.connectors.map((c) => c.id),
      );
      for (const ev of [
        "connect",
        "session_update",
        "session_event",
        "session_delete",
        "disconnect",
        "display_uri",
      ]) {
        p.on(ev, () => {
          dbg("wc.event." + ev, ev === "display_uri" ? undefined : sessionSummary(p.session));
          setTimeout(() => dbg(`wagmi+1s after ${ev}`, wagmiSummary(config)), 1000);
        });
      }
    })
    .catch((e) => dbg("appkit.ready.error", String(e)));
}

export function WalletDebugPanel() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return (
    <div style={{ position: "fixed", right: 6, bottom: 70, zIndex: 99999, fontSize: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded bg-muted px-2 py-1 text-foreground"
      >
        DBG
      </button>
      {open && (
        <div className="mt-1 w-[92vw] max-w-md rounded border bg-background p-2 text-foreground">
          <button
            type="button"
            className="mb-1 rounded bg-primary px-2 py-1 text-primary-foreground"
            onClick={() => void navigator.clipboard?.writeText(lines.join("\n"))}
          >
            Copy log
          </button>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all">
            {lines.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
