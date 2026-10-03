// TEMPORARY diagnostics for the Telegram Android session-settlement bug.
// Read-only: observes AppKit / WalletConnect / Wagmi state, never changes it.
// Logs only safe metadata: no URIs, keys, symKeys, signatures or tokens.
// Topics are reduced to short fingerprints. The log persists across page
// instances (localStorage) so a Telegram reload/new WebView can be correlated
// with the attempt that started before the user left for the wallet.
import { useEffect, useState } from "react";
import { getAccount, getConnections, watchAccount, type Config } from "@wagmi/core";

const PREFIX = "[AZOX-WALLET-DEBUG]";
const STORE_KEY = "azox.walletDebug.log";
const ATTEMPT_KEY = "azox.walletDebug.attempt";
const MAX = 600;

const pageInstanceId = Math.random().toString(36).slice(2, 7);
const t0 = Date.now();
const lines: string[] = loadLines();
const subs = new Set<() => void>();

function loadLines(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function currentAttempt(): string {
  try {
    return localStorage.getItem(ATTEMPT_KEY) ?? "-";
  } catch {
    return "-";
  }
}

function newAttempt(): string {
  const id = "A" + Date.now().toString(36).slice(-5);
  try {
    localStorage.setItem(ATTEMPT_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

/** Short, non-reversible fingerprint of a topic. */
function fp(topic?: string | null) {
  return topic ? topic.slice(0, 6) : null;
}

export function dbg(msg: string, data?: unknown) {
  let s = "";
  try {
    s = data === undefined ? "" : " " + JSON.stringify(data);
  } catch {
    s = " [unserializable]";
  }
  const line = `${new Date().toISOString().slice(11, 23)} +${Date.now() - t0}ms [att=${currentAttempt()} pg=${pageInstanceId}] ${msg}${s}`;
  console.log(PREFIX, line);
  lines.push(line);
  while (lines.length > MAX) lines.shift();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(lines));
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}

/** Function names of the call stack (no arguments/values). */
export function callerTrace() {
  return (new Error().stack ?? "")
    .split("\n")
    .slice(2, 9)
    .map((l) =>
      l
        .trim()
        .replace(/^at\s+/, "")
        .replace(/\(?https?:\/\/[^)]*\/([^/?)]+)[^)]*\)?/, "@$1"),
    )
    .join(" < ");
}

type WcSession = {
  topic?: string;
  pairingTopic?: string;
  expiry?: number;
  acknowledged?: boolean;
  namespaces?: Record<string, { accounts?: string[]; chains?: string[] }>;
  peer?: { metadata?: { name?: string } };
};
type Emitter = { on: (e: string, cb: (...a: unknown[]) => void) => void };
type SignClient = Emitter & {
  session?: { getAll?: () => WcSession[] };
  proposal?: { getAll?: () => { id?: number; pairingTopic?: string; expiryTimestamp?: number }[] };
  core?: {
    relayer?: Emitter & { connected?: boolean; connecting?: boolean };
    pairing?: {
      getPairings?: () => {
        topic?: string;
        active?: boolean;
        expiry?: number;
        peerMetadata?: { name?: string };
      }[];
      events?: Emitter;
    };
  };
};
type UP = Emitter & { session?: WcSession; client?: SignClient };

function sessionSummary(s?: WcSession) {
  if (!s) return null;
  return {
    topic: fp(s.topic),
    pairing: fp(s.pairingTopic),
    acknowledged: s.acknowledged ?? null,
    expiry: s.expiry ?? null,
    peer: s.peer?.metadata?.name ?? null,
    namespaces: Object.fromEntries(
      Object.entries(s.namespaces ?? {}).map(([k, v]) => [
        k,
        { accounts: v.accounts, chains: v.chains },
      ]),
    ),
  };
}

function wcState(p?: UP) {
  const c = p?.client;
  return {
    providerSession: sessionSummary(p?.session),
    relay: {
      connected: c?.core?.relayer?.connected ?? null,
      connecting: c?.core?.relayer?.connecting ?? null,
    },
    pairings: (c?.core?.pairing?.getPairings?.() ?? []).map((x) => ({
      topic: fp(x.topic),
      active: x.active ?? null,
      expiry: x.expiry ?? null,
      peer: x.peerMetadata?.name ?? null,
    })),
    proposals: (c?.proposal?.getAll?.() ?? []).map((x) => ({
      id: x.id ?? null,
      pairing: fp(x.pairingTopic),
      expiry: x.expiryTimestamp ?? null,
    })),
    sessions: (c?.session?.getAll?.() ?? []).map(sessionSummary),
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
    connections: getConnections(config).map((c) => ({ id: c.connector.id, chainId: c.chainId })),
  };
}

function storageMarkers() {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (
        /wagmi|walletConnect|@appkit|recentConnector|requestedChains|connected/i.test(k) &&
        !/wc@2:core|keychain|crypto|azox\.walletDebug/i.test(k)
      ) {
        out[k] = String(localStorage.getItem(k)).slice(0, 80);
      }
    }
    out["wcSessionKey"] = String(
      Object.keys(localStorage).some((k) => k.includes("wc@2:client") && k.includes("session")),
    );
  } catch (e) {
    out["localStorage"] = "unavailable: " + String(e);
  }
  out["cookieKeys"] = document.cookie
    .split(";")
    .map((c) => c.split("=")[0]!.trim())
    .filter((k) => /wagmi|walletConnect|recentConnector/i.test(k))
    .join(",");
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
  dbg("page.boot", {
    path: location.pathname,
    tgPlatform: tg?.platform ?? null,
    tgVersion: tg?.version ?? null,
    navType:
      (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)
        ?.type ?? null,
    visibility: document.visibilityState,
  });
  dbg("storage@boot", storageMarkers());
  dbg("wagmi@boot", wagmiSummary(config));

  watchAccount(config, { onChange: () => dbg("wagmi.account", wagmiSummary(config)) });
  // Wagmi connect()/reconnect lifecycle: connecting → connected (resolve) or
  // connecting → disconnected (reject).
  let prev = config.state.status;
  config.subscribe(
    (s) => s.status,
    (st) => {
      const outcome =
        prev === "connecting" && st === "connected"
          ? "connect.resolved"
          : prev === "connecting" && st === "disconnected"
            ? "connect.rejected"
            : prev === "reconnecting" && st === "connected"
              ? "reconnect.resolved"
              : prev === "reconnecting" && st === "disconnected"
                ? "reconnect.rejected"
                : "transition";
      dbg("wagmi.status", { from: prev, to: st, outcome });
      prev = st;
    },
  );

  let up: UP | undefined;
  const snapshot = (tag: string) => {
    dbg("wc.state@" + tag, wcState(up));
    dbg("wagmi@" + tag, wagmiSummary(config));
  };

  for (const ev of ["visibilitychange", "pageshow", "pagehide", "focus", "blur"] as const) {
    window.addEventListener(ev, (e) => {
      dbg(`lifecycle.${ev}`, {
        visibility: document.visibilityState,
        persisted: (e as PageTransitionEvent).persisted ?? null,
      });
      if (ev !== "pagehide" && ev !== "blur") snapshot(ev);
    });
  }

  const ready = (appKit as { ready?: () => Promise<void> }).ready?.() ?? Promise.resolve();
  void ready
    .then(async () => {
      dbg("appkit.ready");
      up = (await appKit.getUniversalProvider?.()) as UP | undefined;
      dbg("wc.provider", { available: Boolean(up), hasClient: Boolean(up?.client) });
      if (!up) return;
      snapshot("ready");
      dbg(
        "connectors",
        config.connectors.map((c) => c.id),
      );
      for (const conn of config.connectors.filter((c) => c.id === "walletConnect")) {
        const orig = conn.connect.bind(conn);
        (conn as { connect: typeof conn.connect }).connect = ((args?: unknown) => {
          dbg("wagmi.wcConnector.connect.start", { caller: callerTrace() });
          return (orig as (a?: unknown) => Promise<unknown>)(args).then(
            (r) => {
              dbg("wagmi.wcConnector.connect.resolved", wcState(up));
              return r;
            },
            (e: unknown) => {
              dbg("wagmi.wcConnector.connect.rejected", {
                error: e instanceof Error ? e.message : String(e),
              });
              throw e;
            },
          );
        }) as typeof conn.connect;
      }

      for (const ev of [
        "connect",
        "session_update",
        "session_event",
        "session_delete",
        "disconnect",
      ]) {
        up.on(ev, () => {
          dbg("up.event." + ev);
          snapshot("up." + ev);
        });
      }
      up.on("display_uri", () => {
        const id = newAttempt();
        dbg("up.event.display_uri (new attempt)", { attemptId: id });
        snapshot("display_uri");
      });

      const c = up.client;
      for (const ev of [
        "session_proposal",
        "session_connect",
        "session_authenticate",
        "session_update",
        "session_extend",
        "session_event",
        "session_delete",
        "session_expire",
        "proposal_expire",
      ]) {
        c?.on?.(ev, (arg: unknown) => {
          const a = arg as { id?: number; topic?: string } | undefined;
          dbg("sign.event." + ev, { id: a?.id ?? null, topic: fp(a?.topic) });
        });
      }
      for (const ev of ["relayer_connect", "relayer_disconnect", "relayer_error"]) {
        c?.core?.relayer?.on?.(ev, () =>
          dbg("relay." + ev, { connected: c?.core?.relayer?.connected ?? null }),
        );
      }
      for (const ev of ["pairing_create", "pairing_delete", "pairing_expire", "pairing_ping"]) {
        c?.core?.pairing?.events?.on?.(ev, () => dbg("pairing." + ev));
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
          <div className="mb-1 flex gap-2">
            <button
              type="button"
              className="rounded bg-primary px-2 py-1 text-primary-foreground"
              onClick={() => void navigator.clipboard?.writeText(lines.join("\n"))}
            >
              Copy log
            </button>
            <button
              type="button"
              className="rounded bg-muted px-2 py-1 text-foreground"
              onClick={() => {
                lines.length = 0;
                try {
                  localStorage.removeItem(STORE_KEY);
                } catch {
                  /* ignore */
                }
                force((n) => n + 1);
              }}
            >
              Clear
            </button>
          </div>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all">
            {lines.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
