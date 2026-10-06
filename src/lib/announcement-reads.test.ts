import { describe, expect, it } from "vitest";
import { computeHasNew, computeIsUnread, computeUnseenIds, legacyHasNew } from "./announcement-reads";

describe("announcement read helpers", () => {
  it("computeUnseenIds returns unseen ids in order", () => {
    expect(computeUnseenIds([], new Set())).toEqual([]);
    expect(computeUnseenIds(["a", "b"], new Set(["a", "b"]))).toEqual([]);
    expect(computeUnseenIds(["a", "b", "c"], new Set(["b"]))).toEqual(["a", "c"]);
    expect(computeUnseenIds(["b", "a"], new Set())).toEqual(["b", "a"]);
    expect(computeUnseenIds(["a", "a", "b"], new Set())).toEqual(["a", "b"]);
  });
  it("hasNew when any loaded id is unseen", () => {
    expect(computeHasNew(["a", "b"], new Set(["a"]))).toBe(true);
    expect(computeHasNew(["a", "b"], new Set(["a", "b"]))).toBe(false);
    expect(computeHasNew([], new Set())).toBe(false);
  });
  it("isUnread until opened", () => {
    expect(computeIsUnread("a", new Set())).toBe(true);
    expect(computeIsUnread("a", new Set(["a"]))).toBe(false);
  });
  it("legacy fallback compares newest timestamp", () => {
    expect(legacyHasNew(undefined, null)).toBe(false);
    expect(legacyHasNew("t1", null)).toBe(true);
    expect(legacyHasNew("t1", "t1")).toBe(false);
  });
});
