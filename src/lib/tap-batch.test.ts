import { describe, expect, it } from "vitest";
import {
  EMPTY_TAP_STATE,
  TAP_BATCH_MAX_UNITS,
  addTaps,
  confirmBatch,
  parseTapState,
  takeBatch,
  takeInflightOnly,
} from "./tap-batch";

let n = 0;
const id = () => `batch000${++n}`;

describe("tap batching", () => {
  it("accumulates taps", () => {
    let s = addTaps(EMPTY_TAP_STATE, 3);
    s = addTaps(s, 2);
    expect(s).toEqual({ pending: 5, inflight: null });
  });

  it("no-op when nothing pending", () => {
    expect(takeBatch(EMPTY_TAP_STATE, id).batch).toBeNull();
  });

  it("splits in-flight batch from new taps", () => {
    const t = takeBatch(addTaps(EMPTY_TAP_STATE, 7), id);
    expect(t.batch!.units).toBe(7);
    const s = addTaps(t.state, 4);
    expect(s.pending).toBe(4);
    expect(s.inflight).toEqual(t.batch);
    const after = confirmBatch(s, t.batch!.id);
    expect(after).toEqual({ pending: 4, inflight: null });
  });

  it("retries reuse the same batch id until confirmed", () => {
    const t = takeBatch(addTaps(EMPTY_TAP_STATE, 5), id);
    const retry = takeBatch(addTaps(t.state, 1), id);
    expect(retry.batch).toEqual(t.batch);
    expect(confirmBatch(retry.state, "otherid00").inflight).toEqual(t.batch);
  });

  it("caps batch size", () => {
    const t = takeBatch(addTaps(EMPTY_TAP_STATE, TAP_BATCH_MAX_UNITS + 5), id);
    expect(t.batch!.units).toBe(TAP_BATCH_MAX_UNITS);
    expect(t.state.pending).toBe(5);
  });

  it("parses stored state safely", () => {
    expect(parseTapState(null)).toEqual(EMPTY_TAP_STATE);
    expect(parseTapState({ pending: -2, inflight: { id: "x", units: 1 } })).toEqual(
      EMPTY_TAP_STATE,
    );
    expect(parseTapState({ pending: 3, inflight: { id: "abcdefgh1", units: 2 } })).toEqual({
      pending: 3,
      inflight: { id: "abcdefgh1", units: 2 },
    });
  });

  it("lifecycle retry never cuts a fresh pending batch", () => {
    expect(takeInflightOnly(addTaps(EMPTY_TAP_STATE, 9))).toBeNull();
    const t = takeBatch(addTaps(EMPTY_TAP_STATE, 2), id);
    expect(takeInflightOnly(addTaps(t.state, 5))).toEqual(t.batch);
  });

  it("new taps during in-flight are counted exactly once across retry/confirm", () => {
    const t = takeBatch(addTaps(EMPTY_TAP_STATE, 10), id);
    let s = addTaps(t.state, 3);
    s = takeBatch(s, id).state; // retry: same batch, pending untouched
    expect(s).toEqual({ pending: 3, inflight: t.batch });
    s = confirmBatch(s, t.batch!.id);
    const next = takeBatch(s, id);
    expect(next.batch!.units).toBe(3);
    expect(next.state.pending).toBe(0);
  });
});
