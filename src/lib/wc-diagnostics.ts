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

const PREFIX_LEN = 8;
function pfx(t: unknown): string | null {
  const s = t == null ? "" : String(t);
  return s ? `${s.slice(0, PREFIX_LEN)}…` : null;
}

function pairingPrefixes(provider: unknown): string[] {
  try {
    const pairings = core(provider)?.pairing?.getPairings?.() ?? [];
    return pairings
      .map((p) => pfx((p as { topic?: string })?.topic))
      .filter((p): p is string => Boolean(p));
  } catch {
    return [];
  }
}

function relayState(provider: unknown) {
  const c = core(provider);
  const sub = c?.relayer?.subscriber;
  let topicPrefixes: string[] = [];
  try {
    // Short prefixes only — never the full topic.
    topicPrefixes = (sub?.topics ?? []).map((t) => pfx(t) as string);
  } catch {
    topicPrefixes = [];
  }
  const pairPrefixes = pairingPrefixes(provider);
  return {
    relayConnected: c?.relayer?.connected ?? null,
    subscriptionCount: sub?.length ?? topicPrefixes.length,
    subscriptionTopicPrefixes: topicPrefixes,
    pairingTopicPrefixes: pairPrefixes,
    pairingCount: pairPrefixes.length,
  };
}

// --- Current-attempt identity (observation only) ---------------------------
// Verified against the INSTALLED @walletconnect/sign-client 2.23.7 source:
//
//  * engine.connect() creates the pairing, then stores the proposal via
//    setProposal(id, { ..., pairingTopic }). The proposal Store is public
//    (`client.proposal`), so the CURRENT attempt's pairing topic is readable
//    with a plain getAll() — no monkey-patching, no engine instrumentation.
//    Reading a Store is side-effect free.
//  * engine.onSessionProposeResponse() derives the session topic from the
//    responder public key and records it in `engine.pendingSessions`
//    (Map<proposalId, { sessionTopic, pairingTopic }>). That Map is the only
//    observable place where the proposer LEARNS the session topic; it is an
//    engine-internal field but readable without patching anything.
//  * relayer emits `relayer_message` with { topic, message, publishedAt, ... }
//    (topic always present), but `relayer_message_ack` emits the raw JSON-RPC
//    ack `{ id, result }` — it has NO topic, ever.

type ProposalRecord = {
  id?: number;
  pairingTopic?: string;
  expiryTimestamp?: number;
};

function currentProposal(provider: unknown): ProposalRecord | null {
  try {
    const store = (
      provider as {
        client?: { proposal?: { getAll?: () => ProposalRecord[] } };
      }
    )?.client?.proposal;
    const all = store?.getAll?.() ?? [];
    const nowSec = Math.floor(Date.now() / 1000);
    const live = all.filter(
      (p) => !p?.expiryTimestamp || p.expiryTimestamp > nowSec,
    );
    const pool = live.length > 0 ? live : all;
    if (pool.length === 0) return null;
    // Most recent proposal = highest expiry (proposals all share the same TTL).
    return pool.reduce((a, b) =>
      (b?.expiryTimestamp ?? 0) >= (a?.expiryTimestamp ?? 0) ? b : a,
    );
  } catch {
    return null;
  }
}

function pendingSessionTopics(provider: unknown): string[] {
  try {
    const pending = (
      provider as {
        client?: {
          engine?: { pendingSessions?: Map<number, { sessionTopic?: string }> };
        };
      }
    )?.client?.engine?.pendingSessions;
    if (!pending || typeof pending.forEach !== "function") return [];
    const out: string[] = [];
    pending.forEach((v) => {
      const p = pfx(v?.sessionTopic);
      if (p) out.push(p);
    });
    return out;
  } catch {
    return [];
  }
}

function attemptIdentity(provider: unknown) {
  const proposal = currentProposal(provider);
  const pending = pendingSessionTopics(provider);
  return {
    // The CURRENT attempt's pairing topic, from the proposal store (never
    // from the set of all persisted pairings).
    currentPairingTopicPrefix: pfx(proposal?.pairingTopic),
    currentPairingTopicKnown: Boolean(proposal?.pairingTopic),
    currentProposalExists: Boolean(proposal),
    // The session topic the PROPOSER derived, if onSessionProposeResponse ran.
    sessionTopicPrefix: pending[pending.length - 1] ?? null,
    sessionTopicKnown: pending.length > 0,
    pendingSessionCount: pending.length,
  };
}

// --- FROZEN per-attempt identity (observation only) ------------------------
// Captured once from the actual tag=1100 relayer_publish event and NEVER
// re-derived afterwards. proposal_expire MUST use these frozen values only.
let attemptStartedAt: number | null = null;
let attemptProposeTopicPrefix: string | null = null;
// Frozen identity of the CURRENT attempt:
let frozenProposalId: number | null = null; // numeric id, for pendingSessions.get
let frozenProposalIdPrefix: string | null = null;
let frozenPairingTopicPrefix: string | null = null;
let frozenProposalRemainingMs: number | null = null;
let frozenSessionTopicPrefix: string | null = null;
let messagesWithTopic = 0;
let messagesWithNoTopic = 0;
let acksWithTopic = 0;
let acksWithNoTopic = 0;
let totalInboundMessages = 0;
let messagesOnCurrentPairingTopic = 0;
let messagesOnProposeTopic = 0;
let messagesOnSessionTopic = 0;

function elapsedSinceAttempt() {
  return attemptStartedAt === null ? null : Date.now() - attemptStartedAt;
}

/** Freeze the current proposal as THIS attempt's identity (once, at start). */
function freezeAttemptIdentity(provider: unknown) {
  const proposal = currentProposal(provider);
  frozenProposalId = typeof proposal?.id === "number" ? proposal.id : null;
  frozenProposalIdPrefix =
    frozenProposalId === null ? null : String(frozenProposalId).slice(0, 8);
  frozenPairingTopicPrefix = pfx(proposal?.pairingTopic);
  frozenProposalRemainingMs = proposal?.expiryTimestamp
    ? Math.max(0, proposal.expiryTimestamp * 1000 - Date.now())
    : null;
  frozenSessionTopicPrefix = null;
}

/**
 * Observation-only session-topic discovery: reads engine.pendingSessions for
 * the FROZEN proposal id. Never infers the session topic from subscriptions.
 */
function observeFrozenSessionTopic(provider: unknown) {
  if (frozenProposalId === null || frozenSessionTopicPrefix !== null) return;
  try {
    const pending = (
      provider as {
        client?: {
          engine?: {
            pendingSessions?: Map<number, { sessionTopic?: string }>;
          };
        };
      }
    )?.client?.engine?.pendingSessions;
    const entry = pending?.get?.(frozenProposalId);
    const p = pfx(entry?.sessionTopic);
    if (p) frozenSessionTopicPrefix = p;
  } catch {
    /* observation only */
  }
}

/** Frozen identity as a loggable block. */
function frozenAttemptFields() {
  return {
    attemptProposalIdPrefix: frozenProposalIdPrefix ?? "unavailable",
    attemptPairingTopicPrefix: frozenPairingTopicPrefix ?? "unavailable",
    attemptProposeTopicPrefix: attemptProposeTopicPrefix ?? "unavailable",
    attemptIdentityFrozen: frozenProposalId !== null,
  };
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
      ...attemptIdentity(provider),
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
          observeFrozenSessionTopic(provider);
          diag("session_connect", {
            ...providerSnapshot(provider),
            ...relayState(provider),
            ...frozenAttemptFields(),
            currentSessionTopicPrefix: frozenSessionTopicPrefix,
            elapsedMsSinceConnectionAttempt: elapsedSinceAttempt(),
          });
          return;
        }
        if (name === "proposal_expire") {
          observeFrozenSessionTopic(provider);
          // FROZEN identity only — never currentProposal()/rediscovery here.
          diag(`signclient event: ${name}`, {
            ...providerSnapshot(provider),
            ...relayState(provider),
            ...frozenAttemptFields(),
            currentSessionTopicPrefix: frozenSessionTopicPrefix,
            pendingSessionsCount: pendingSessionTopics(provider).length,
            elapsedMsSinceConnectionAttempt: elapsedSinceAttempt(),
            totalInboundMessages,
            messagesWithTopic,
            messagesWithNoTopic,
            acksWithTopic,
            acksWithNoTopic,
            messagesOnCurrentPairingTopic,
            messagesOnProposeTopic,
            messagesOnSessionTopic,
            // Final verdict honesty guard: "the wallet sent nothing" may ONLY
            // be claimed when (1) attempt identity was captured from a real
            // tag=1100 event, (2) the pairing topic is frozen, (3) every
            // inbound relayer message exposed its topic, (4) observation ran
            // until proposal_expire, and (5)+(6) no message matched the frozen
            // pairing/session topics. Anything else -> "unable to determine".
            verdict:
              !attemptStartedAt ||
              frozenPairingTopicPrefix === null ||
              messagesWithNoTopic > 0
                ? "unable to determine"
                : messagesOnCurrentPairingTopic === 0 &&
                    messagesOnSessionTopic === 0
                  ? "no incoming message on the frozen attempt topics"
                  : "incoming message observed on the frozen attempt topics",
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
        if (name === "relayer_message" || name === "relayer_message_ack") {
          // Verified against installed @walletconnect/core 2.23.7:
          // `relayer_message` emits { topic, message, publishedAt, ... }
          // (topic ALWAYS present); `relayer_message_ack` emits the raw
          // JSON-RPC ack `{ id, result }` — it has NO topic, ever. Acks are
          // therefore never topic-correlated.
          const rawTopic = (payload as { topic?: string } | undefined)?.topic;
          const topicPresent = typeof rawTopic === "string" && rawTopic !== "";
          // ONLY an 8-char topic prefix — never the message payload.
          const topicPrefix = topicPresent ? pfx(rawTopic) : null;
          if (name === "relayer_message") {
            totalInboundMessages += 1;
            observeFrozenSessionTopic(provider);
            if (topicPresent) {
              messagesWithTopic += 1;
              if (topicPrefix && topicPrefix === frozenPairingTopicPrefix) {
                messagesOnCurrentPairingTopic += 1;
              }
              if (topicPrefix && topicPrefix === attemptProposeTopicPrefix) {
                messagesOnProposeTopic += 1;
              }
              if (topicPrefix && topicPrefix === frozenSessionTopicPrefix) {
                messagesOnSessionTopic += 1;
              }
            } else {
              // No topic on the event -> never increment a topic counter.
              messagesWithNoTopic += 1;
            }
          } else if (topicPresent) {
            acksWithTopic += 1;
          } else {
            acksWithNoTopic += 1;
          }
          extra["topicPresent"] = topicPresent;
          extra["topicPrefix"] = topicPrefix;
          extra["matchesAttemptPairingTopic"] = topicPresent
            ? topicPrefix === frozenPairingTopicPrefix
            : null;
          extra["matchesProposeTopic"] = topicPresent
            ? topicPrefix === attemptProposeTopicPrefix
            : null;
          extra["matchesCurrentSessionTopic"] = topicPresent
            ? topicPrefix === frozenSessionTopicPrefix
            : null;
          extra["elapsedMsSinceConnectionAttempt"] = elapsedSinceAttempt();
          extra["totalInboundMessages"] = totalInboundMessages;
          extra["messagesWithTopic"] = messagesWithTopic;
          extra["messagesWithNoTopic"] = messagesWithNoTopic;
          extra["acksWithTopic"] = acksWithTopic;
          extra["acksWithNoTopic"] = acksWithNoTopic;
          extra["messagesOnCurrentPairingTopic"] = messagesOnCurrentPairingTopic;
          extra["messagesOnProposeTopic"] = messagesOnProposeTopic;
          extra["messagesOnSessionTopic"] = messagesOnSessionTopic;
          Object.assign(extra, frozenAttemptFields());
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
  //
  // RAW PAYLOAD INSPECTION (observation only): observe EVERY relayer_publish
  // before any tag filtering, so we can determine whether the event reaches
  // this watcher at all, and where the tag actually lives at runtime.
  try {
    relayer.on("relayer_publish", (payload?: unknown) => {
      // Verified against INSTALLED @walletconnect/core 2.23.7 Publisher:
      //   publish(topic, message, opts) builds
      //     request = { id, method, params: { topic, message, ttl, prompt, tag } }
      //   and emits events.emit("relayer_publish", { ...request, ...opts }).
      // Therefore the tag is exposed at BOTH verified locations:
      //   payload.params.tag  (request params — always set, defaults to 0)
      //   payload.tag         (opts spread — set when caller passed opts.tag)
      // There is NO payload.opts.tag in the installed version.
      const p = payload as
        | {
            method?: string;
            params?: { tag?: number; topic?: string };
            tag?: number;
          }
        | undefined;

      // --- RAW observation of EVERY publish (no tag pre-filter) ------------
      relayerPublishObserved = true;
      relayerPublishCount += 1;
      const method = typeof p?.method === "string" ? p.method : null;
      const paramsTag =
        typeof p?.params?.tag === "number" ? p.params.tag : null;
      const topLevelTag = typeof p?.tag === "number" ? p.tag : null;
      const paramsTopicPrefix = pfx(p?.params?.topic);
      const payloadKeys = p && typeof p === "object" ? Object.keys(p) : [];
      const paramsKeys =
        p?.params && typeof p.params === "object" ? Object.keys(p.params) : [];
      if (method) observedMethods.add(method);
      if (paramsTag !== null) observedParamsTags.add(paramsTag);
      if (topLevelTag !== null) observedTopLevelTags.add(topLevelTag);
      for (const k of payloadKeys) observedPayloadKeys.add(k);
      for (const k of paramsKeys) observedParamsKeys.add(k);
      // Never log message payloads, full topics, or URIs — keys/prefixes only.
      diag("relayer_publish raw", {
        eventReceived: true,
        method,
        paramsTag,
        topLevelTag,
        paramsTopicPrefix,
        payloadKeys: payloadKeys.join(","),
        paramsKeys: paramsKeys.join(","),
        relayConnected: core(provider)?.relayer?.connected ?? null,
        elapsedMsSinceConnectionAttempt: elapsedSinceAttempt(),
      });
      // ----------------------------------------------------------------------

      // Tag 1100 detection at EITHER verified location — no silent choice.
      if (paramsTag !== 1100 && topLevelTag !== 1100) return;
      tag1100Observed = true;
      tag1100Count += 1;
      const detectedTag = paramsTag === 1100 ? paramsTag : topLevelTag;
      attemptStartedAt = Date.now();
      const snap = relayState(provider);
      // Freeze THIS attempt's identity immediately — never re-derived later.
      freezeAttemptIdentity(provider);
      // The propose topic lives on the PAIRING topic, from request params.
      attemptProposeTopicPrefix = pfx(p?.params?.topic);
      messagesWithTopic = 0;
      messagesWithNoTopic = 0;
      acksWithTopic = 0;
      acksWithNoTopic = 0;
      totalInboundMessages = 0;
      messagesOnCurrentPairingTopic = 0;
      messagesOnProposeTopic = 0;
      messagesOnSessionTopic = 0;
      diag("connection-attempt-start", {
        ...providerSnapshot(provider),
        ...frozenAttemptFields(),
        detectedTag,
        proposeTopicPrefix: attemptProposeTopicPrefix,
        currentPairingTopicPrefix: frozenPairingTopicPrefix,
        currentProposalExists: frozenProposalId !== null,
        pendingSessionsCount: pendingSessionTopics(provider).length,
        proposalRemainingMs: frozenProposalRemainingMs,
        proposeTopicIsFrozenPairingTopic:
          attemptProposeTopicPrefix !== null &&
          attemptProposeTopicPrefix === frozenPairingTopicPrefix,
        subscriptionCount: snap.subscriptionCount,
        relayConnected: snap.relayConnected,
        elapsedMsSinceConnectionAttempt: 0,
      });
    });
  } catch {
    /* event may not be supported */
  }
}

/**
 * Subscriber events (installed @walletconnect/core 2.23.7 names).
 * Correlation only: a `subscription_created` is NOT evidence of the session
 * topic (re-subscriptions after a relayer reconnect create many). The session
 * topic is reported separately from `engine.pendingSessions`.
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
        const rawTopic = (payload as { topic?: string } | undefined)?.topic;
        const topicPresent = typeof rawTopic === "string" && rawTopic !== "";
        const topicPrefix = topicPresent ? pfx(rawTopic) : null;
        queueMicrotask(() => {
          const after = relayState(provider);
          const ident = attemptIdentity(provider);
          diag(`subscriber event: ${name}`, {
            subscriptionCountBefore: before,
            subscriptionCountAfter: after.subscriptionCount,
            topicPresent,
            topicPrefix,
            matchesCurrentPairingTopic: topicPresent
              ? topicPrefix === ident.currentPairingTopicPrefix
              : null,
            matchesSessionTopic: topicPresent
              ? topicPrefix === ident.sessionTopicPrefix
              : null,
            ...ident,
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
