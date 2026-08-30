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

export function diag(event: string, data?: Record<string, unknown>) {
  if (!AZOX_WC_DIAGNOSTICS) return;
  try {
    // eslint-disable-next-line no-console
    console.log(`${TAG} ${event}`, { ...base(), ...(data ?? {}) });
  } catch {
    /* diagnostics must never throw */
  }
}

type AnyProvider = {
  session?: {
    namespaces?: Record<string, { accounts?: string[] } | undefined>;
  } | null;
  client?: { session?: { getAll?: () => unknown[] } };
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
    eip155: Boolean(eip155),
    accountCount: accounts.length,
    chainIds,
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
        };
      }
    )?.state;
    const connections = state?.connections;
    const entries = connections ? Array.from(connections.values()) : [];
    return {
      connectionsSize: connections?.size ?? 0,
      currentExists: Boolean(state?.current),
      connectionEntries: entries.length,
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
      const isSessionProbe =
        name === "visibilitychange" ||
        name === "pageshow" ||
        name === "focus" ||
        name === "online";
      diag(`lifecycle: ${name}`, {
        ...(isSessionProbe
          ? { snapshot: snapshot(), storage: storageKeySnapshot() }
          : {}),
      });
    });
  }
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
