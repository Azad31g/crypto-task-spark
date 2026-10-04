// Pure Main Tap batching state (no IO, SSR-safe). The hook persists it.
export const TAP_BATCH_INTERVAL_MS = 10 * 60 * 1000;
export const TAP_BATCH_MAX_UNITS = 20_000;
export const TAP_BATCH_STORAGE_KEY = "azox:tapBatch:v1";

export type TapBatch = { id: string; units: number };
export type TapBatchState = { pending: number; inflight: TapBatch | null };

export const EMPTY_TAP_STATE: TapBatchState = { pending: 0, inflight: null };

export function newBatchId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function addTaps(s: TapBatchState, units: number): TapBatchState {
  const n = Math.max(0, Math.floor(units));
  return n ? { ...s, pending: s.pending + n } : s;
}

/**
 * Returns the batch to submit: the existing in-flight batch (same id, safe
 * retry), or a new one cut from pending (capped). Null when nothing pending.
 */
export function takeBatch(
  s: TapBatchState,
  makeId: () => string = newBatchId,
): { state: TapBatchState; batch: TapBatch | null } {
  if (s.inflight) return { state: s, batch: s.inflight };
  if (s.pending <= 0) return { state: s, batch: null };
  const units = Math.min(s.pending, TAP_BATCH_MAX_UNITS);
  const batch = { id: makeId(), units };
  return { state: { pending: s.pending - units, inflight: batch }, batch };
}

/** Clears the in-flight batch only if the server confirmed this id. */
export function confirmBatch(s: TapBatchState, id: string): TapBatchState {
  return s.inflight?.id === id ? { ...s, inflight: null } : s;
}

export function parseTapState(raw: unknown): TapBatchState {
  const r = raw as Partial<TapBatchState> | null;
  const pending = Number.isInteger(r?.pending) && r!.pending! > 0 ? r!.pending! : 0;
  const f = r?.inflight;
  const inflight =
    f && typeof f.id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(f.id) && Number.isInteger(f.units) && f.units > 0
      ? { id: f.id, units: Math.min(f.units, TAP_BATCH_MAX_UNITS) }
      : null;
  return { pending, inflight };
}
