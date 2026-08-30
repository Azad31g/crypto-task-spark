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

// --- Transport-level, observation-only watchers ----------------------------
// Event names below were verified against the INSTALLED sources:
//   @walletconnect/core 2.23.7        -> relayer_* / subscription_* names
//   @walletconnect/sign-client 2.23.7 -> session_connect / proposal_expire
// `session_settle` is NOT a public SignClient event and is no longer used.
//
// None of these listeners call connect/disconnect/subscribe/unsubscribe/
// publish/approve/set/delete, and none write storage.

type AnyEmitter = {
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
};

type AnyCore = {
  relayer?: AnyEmitter & {
    connected?: boolean;
    subscriber?: AnyEmitter & { length?: number; topics?: string[] };
  };
  pairing?: { getPairings?: () => unknown[] };
};

function core(provider: unknown): AnyCore | undefined {
  return (provider as { client?: { core?: AnyCore } })?.client?.core;
}

function relayState(provider: unknown) {
  const c = core(provider);
  const sub = c?.relayer?.subscriber;
  let topicPrefixes: string[] = [];
  try {
    // Short prefixes only — never the full topic.
    topicPrefixes = (sub?.topics ?? []).map((t) => `${String(t).slice(0, 8)}…`);
  } catch {
    topicPrefixes = [];
  }
  let pairingCount: number | null = null;
  try {
    pairingCount = c?.pairing?.getPairings?.().length ?? null;
  } catch {
    pairingCount = null;
  }
  return {
    relayConnected: c?.relayer?.connected ?? null,
    subscriptionCount: sub?.length ?? topicPrefixes.length,
    subscriptionTopicPrefixes: topicPrefixes,
    pairingCount,
  };
}

// Set when a wc_sessionPropose publish is observed (start of an attempt).
let attemptStartedAt: number | null = null;
let subscriptionsAtAttemptStart: string[] = [];

function elapsedSinceAttempt() {
  return attemptStartedAt === null ? null : Date.now() - attemptStartedAt;
}

/** SignClient success/expiry signals on the EXISTING provider.client. */
export function signClientWatch(provider: unknown) {
  if (!AZOX_WC_DIAGNOSTICS) return;
  const client = (provider as AnyProvider)?.client;
  if (typeof client?.on !== "function") return;

  const log = (name: string, extra?: Record<string, unknown>) =>
    diag(`signclient event: ${name}`, {
      ...providerSnapshot(provider),
      ...relayState(provider),
      ...(extra ?? {}),
    });

  const events = [
    "session_proposal",
    "session_connect", // definitive successful session-connect event
    "session_expire",
    "session_request_sent",
    "proposal_expire",
  ];
  for (const name of events) {
    try {
      client.on(name, () => {
        if (name === "session_connect") {
          diag("session_connect", {
            ...providerSnapshot(provider),
            ...relayState(provider),
            elapsedMsSinceConnectionAttempt: elapsedSinceAttempt(),
          });
          return;
        }
        if (name === "proposal_expire") {
          log(name, {
            elapsedMsSinceConnectionAttempt: elapsedSinceAttempt(),
            subscriptionsAtAttemptStart: subscriptionsAtAttemptStart.length,
          });
          return;
        }
        log(name);
      });
    } catch {
      /* event may not be supported by this SignClient version */
    }
  }
}

/** Relayer transport events (installed @walletconnect/core 2.23.7 names). */
export function relayerWatch(provider: unknown) {
  if (!AZOX_WC_DIAGNOSTICS) return;
  const relayer = core(provider)?.relayer;
  if (typeof relayer?.on !== "function") return;

  for (const name of [
    "relayer_connect",
    "relayer_disconnect",
    "relayer_connection_stalled",
    "relayer_message",
    "relayer_message_ack",
    "relayer_error",
    "relayer_transport_closed",
  ]) {
    try {
      relayer.on(name, (payload?: unknown) => {
        const extra: Record<string, unknown> = {};
        if (name === "relayer_message") {
          // ONLY an 8-char topic prefix — never the message payload.
          const topic = (payload as { topic?: string } | undefined)?.topic;
          extra["topicPrefix"] = topic ? `${String(topic).slice(0, 8)}…` : null;
        }
        diag(`relayer event: ${name}`, {
          ...relayState(provider),
          ...extra,
        });
      });
    } catch {
      /* event may not be supported */
    }
  }

  // Attempt boundary: the engine publishes wc_sessionPropose (tag 1100) at the
  // start of every connect() attempt. Observational only — no publish is made.
  try {
    relayer.on("relayer_publish", (payload?: unknown) => {
      const tag = (payload as { opts?: { tag?: number } } | undefined)?.opts
        ?.tag;
      if (tag !== 1100) return;
      attemptStartedAt = Date.now();
      const snap = relayState(provider);
      subscriptionsAtAttemptStart = snap.subscriptionTopicPrefixes;
      diag("connection-attempt-start", {
        ...providerSnapshot(provider),
        ...snap,
      });
    });
  } catch {
    /* event may not be supported */
  }
}

/**
 * Subscriber events (installed @walletconnect/core 2.23.7 names).
 * NOTE: `subscription_created` is only a CORRELATION signal that some topic
 * subscription appeared. It does NOT by itself prove that the engine's
 * onSessionProposeResponse() ran: in the installed sign-client that handler's
 * only safely observable public consequence is a NEW subscriber subscription
 * on the derived session topic (plus pairing activation). Compare the
 * post-approval topic prefixes against `subscriptionsAtAttemptStart` to tell
 * the pairing subscription apart from a session-topic subscription.
 */
export function subscriberWatch(provider: unknown) {
  if (!AZOX_WC_DIAGNOSTICS) return;
  const subscriber = core(provider)?.relayer?.subscriber;
  if (typeof subscriber?.on !== "function") return;

  for (const name of [
    "subscription_created",
    "subscription_deleted",
    "subscription_resubscribed",
    "subscription_expired",
    "subscription_sync",
  ]) {
    try {
      subscriber.on(name, (payload?: unknown) => {
        const before = relayState(provider).subscriptionCount;
        // Counts are read synchronously; the "after" read happens on the next
        // microtask so the subscriber map has settled. No mutation occurs.
        const topic = (payload as { topic?: string } | undefined)?.topic;
        queueMicrotask(() => {
          const after = relayState(provider);
          diag(`subscriber event: ${name}`, {
            subscriptionCountBefore: before,
            subscriptionCountAfter: after.subscriptionCount,
            topicPrefix: topic ? `${String(topic).slice(0, 8)}…` : null,
            isNewSinceAttemptStart: topic
              ? !subscriptionsAtAttemptStart.includes(
                  `${String(topic).slice(0, 8)}…`,
                )
              : null,
            subscriptionsAtAttemptStart: subscriptionsAtAttemptStart.length,
            relayConnected: after.relayConnected,
            elapsedMsSinceConnectionAttempt: elapsedSinceAttempt(),
          });
        });
      });
    } catch {
      /* event may not be supported */
    }
  }
}

