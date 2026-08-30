// TEMPORARY, OBSERVATIONAL-ONLY diagnostics for the WalletConnect session
// lifecycle inside the Telegram Mini App. Nothing here connects, disconnects,
// writes storage, or mutates provider/AppKit/Wagmi state. Remove once the
// physical Android evidence has been collected.
//
// Never logs: URIs, addresses, tokens, initData, cookies, projectId, secrets,
// full objects, or full URLs.
export const AZOX_WC_DIAGNOSTICS = true;

const TAG = "[AZOX-WC-DIAG]";

function randomId() {
  try {
    return Math.random().toString(16).slice(2, 10).toUpperCase();
  } catch {
    return "UNKNOWN";
  }
}

export const pageInstanceId =
  typeof window === "undefined" ? "SSR" : randomId();

function base() {
  const hasPerf = typeof performance !== "undefined";
  return {
    pageInstanceId,
    timeOrigin: hasPerf ? Math.round(performance.timeOrigin) : null,
    now: hasPerf ? Math.round(performance.now()) : null,
    timestamp: new Date().toISOString(),
    visibilityState:
      typeof document !== "undefined" ? document.visibilityState : null,
    hasFocus:
      typeof document !== "undefined" && typeof document.hasFocus === "function"
        ? document.hasFocus()
        : null,
    pathname: typeof location !== "undefined" ? location.pathname : null,
  };
}

/**
 * Flat, primitive-only console output: DevTools shows the values inline
 * instead of a collapsed "Object".
 */
export function diag(event: string, data?: Record<string, unknown>) {
  if (!AZOX_WC_DIAGNOSTICS) return;
  try {
    const flat: Record<string, unknown> = {};
    const walk = (prefix: string, value: unknown) => {
      if (value === null || typeof value !== "object") {
        flat[prefix] = value;
        return;
      }
      if (Array.isArray(value)) {
        flat[prefix] = JSON.stringify(value);
        return;
      }
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(prefix ? `${prefix}.${k}` : k, v);
      }
    };
    walk("", { ...base(), ...(data ?? {}) });
    // eslint-disable-next-line no-console
    console.log(`${TAG} ${event} ${JSON.stringify(flat)}`);
  } catch {
    /* diagnostics must never throw */
  }
}

type AnyProvider = {
  session?: {
    topic?: string;
    namespaces?: Record<string, { accounts?: string[] } | undefined>;
  } | null;
  client?: {
    session?: { getAll?: () => unknown[] };
    core?: { pairing?: { getPairings?: () => unknown[] } };
    on?: (event: string, cb: (...args: unknown[]) => void) => void;
  };
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
};

/** Sanitized snapshot of the UniversalProvider / SignClient session state. */
export function providerSnapshot(provider: unknown) {
  const p = provider as AnyProvider | null | undefined;
  let sessionCount: number | null = null;
  try {
    sessionCount = p?.client?.session?.getAll?.().length ?? null;
  } catch {
    sessionCount = null;
  }
  let pairingCount: number | null = null;
  try {
    pairingCount = p?.client?.core?.pairing?.getPairings?.().length ?? null;
  } catch {
    pairingCount = null;
  }
  const topic = p?.session?.topic;
  const eip155 = p?.session?.namespaces?.["eip155"];
  const accounts = eip155?.accounts ?? [];
  const chainIds = Array.from(
    new Set(
      accounts
        .map((a) => Number.parseInt(String(a).split(":")[1] ?? "", 10))
        .filter((n) => Number.isFinite(n)),
    ),
  );
  return {
    providerExists: Boolean(p),
    sessionExists: Boolean(p?.session),
    sessionCount,
    pairingCount,
    // Sanitized: 8-char prefix only, never the full topic.
    sessionTopic: topic ? `${String(topic).slice(0, 8)}…` : null,
    eip155Exists: Boolean(eip155),
    eip155AccountCount: accounts.length,
    eip155ChainIds: chainIds,
  };
}

/** Sanitized snapshot of the wagmi config state. */
export function wagmiSnapshot(config: unknown) {
  try {
    const state = (
      config as {
        state?: {
          connections?: Map<string, unknown>;
          current?: string | null;
          chainId?: number;
          status?: string;
        };
      }
    )?.state;
    const connections = state?.connections;
    const entries = connections ? Array.from(connections.values()) : [];
    const currentId = state?.current ?? null;
    const currentConn = currentId
      ? (connections?.get(currentId) as
          | { connector?: { id?: string } }
          | undefined)
      : undefined;
    return {
      connectionsSize: connections?.size ?? 0,
      currentExists: Boolean(state?.current),
      connectionEntries: entries.length,
      status: state?.status ?? null,
      currentConnectorId: currentConn?.connector?.id ?? null,
      connectorIds: entries.map(
        (e) =>
          (e as { connector?: { id?: string } })?.connector?.id ?? "unknown",
      ),
      chainId: state?.chainId ?? null,
      accountCount: entries.reduce<number>(
        (n, e) => n + ((e as { accounts?: unknown[] })?.accounts ?? []).length,
        0,
      ),
    };
  } catch (err) {
    return { error: (err as Error)?.name ?? "unknown" };
  }
}

/** Booleans only — never values. */
export function storageKeySnapshot() {
  const check = (key: string) => {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(key) !== null
        : false;
    } catch {
      return false;
    }
  };
  let requestedChains: number[] | null = null;
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("walletConnect.requestedChains")
        : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : parsed?.state ?? [];
      requestedChains = (Array.isArray(arr) ? arr : [])
        .map((v: unknown) => Number(v))
        .filter((v: number) => Number.isFinite(v));
    }
  } catch {
    requestedChains = null;
  }
  return {
    requestedChainsKeyExists: check("walletConnect.requestedChains"),
    recentConnectorKeyExists: check("wagmi.recentConnectorId"),
    wagmiStoreKeyExists: check("wagmi.store"),
    requestedChains,
  };
}

let lifecycleAttached = false;
export function attachLifecycleDiagnostics(snapshot: () => unknown) {
  if (!AZOX_WC_DIAGNOSTICS || lifecycleAttached) return;
  if (typeof window === "undefined") return;
  lifecycleAttached = true;
  const events = [
    "visibilitychange",
    "pageshow",
    "pagehide",
    "focus",
    "blur",
    "online",
    "offline",
  ];
  for (const name of events) {
    const target: EventTarget =
      name === "visibilitychange" ? document : window;
    target.addEventListener(name, () => {
      const label =
        name === "visibilitychange"
          ? `lifecycle: visibilitychange ${
              typeof document !== "undefined"
                ? document.visibilityState
                : "unknown"
            }`
          : `lifecycle: ${name}`;
      diag(label, {
        snapshot: snapshot(),
        storage: storageKeySnapshot(),
      });
      // The wallet leaving the Mini App is signalled by pagehide/blur/hidden.
      if (
        name === "pagehide" ||
        name === "blur" ||
        (name === "visibilitychange" &&
          typeof document !== "undefined" &&
          document.visibilityState === "hidden")
      ) {
        startSettlementPoll(snapshot);
      }
    });
  }
}

// --- Bounded, observation-only settlement poller ---------------------------
// Reads state only. Never calls connect()/disconnect(), never writes storage,
// never touches Wagmi state.
let pollTimer: ReturnType<typeof setInterval> | null = null;
function startSettlementPoll(snapshot: () => unknown) {
  if (!AZOX_WC_DIAGNOSTICS || pollTimer) return;
  const startedAt = Date.now();
  diag("settle-poll:start", { snapshot: snapshot() });
  pollTimer = setInterval(() => {
    let snap: Record<string, unknown> = {};
    try {
      snap = (snapshot() ?? {}) as Record<string, unknown>;
    } catch {
      snap = {};
    }
    const elapsed = Date.now() - startedAt;
    diag("settle-poll", {
      elapsedMs: elapsed,
      snapshot: snap,
      storage: storageKeySnapshot(),
    });
    const settled =
      snap["sessionExists"] === true || Number(snap["sessionCount"] ?? 0) > 0;
    if (settled || elapsed >= 30_000) {
      diag("settle-poll:stop", {
        reason: settled ? "session-appeared" : "timeout",
        elapsedMs: elapsed,
        snapshot: snap,
      });
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }
  }, 500);
}

export function attachProviderDiagnostics(provider: unknown) {
  if (!AZOX_WC_DIAGNOSTICS) return;
  const p = provider as AnyProvider;
  if (typeof p?.on !== "function") return;
  for (const name of [
    "connect",
    "disconnect",
    "session_delete",
    "session_event",
    "session_update",
  ]) {
    try {
      p.on(name, () => {
        diag(`provider event: ${name}`, providerSnapshot(provider));
      });
    } catch {
      /* event may not be supported */
    }
  }
}

/**
 * Observation-only SignClient listeners on the EXISTING provider.client.
 * They log the event name plus a sanitized snapshot; no WalletConnect
 * operation is invoked from any listener.
 */
export function settleWatch(provider: unknown) {
  if (!AZOX_WC_DIAGNOSTICS) return;
  const client = (provider as AnyProvider)?.client;
  if (typeof client?.on !== "function") return;
  for (const name of [
    "session_proposal",
    "session_settle",
    "session_approve",
    "session_expire",
    "session_request_sent",
    "proposal_expire",
  ]) {
    try {
      client.on(name, () => {
        diag(`signclient event: ${name}`, providerSnapshot(provider));
      });
    } catch {
      /* event may not be supported by this SignClient version */
    }
  }
}
