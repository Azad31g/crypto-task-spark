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

import { mergeAnnouncements } from "./announcement-reads";
describe("mergeAnnouncements", () => {
  const a = (id: string, t: string) => ({ id, created_at: t });
  it("dedupes, sorts newest first, limits", () => {
    expect(
      mergeAnnouncements(
        [a("1", "2026-01-01T00:00:00Z"), a("2", "2026-01-03T00:00:00Z")],
        [a("2", "2026-01-03T00:00:00Z"), a("3", "2026-01-02T00:00:00Z")],
      ).map((x) => x.id),
    ).toEqual(["2", "3", "1"]);
    const many = Array.from({ length: 30 }, (_, i) => a(String(i), new Date(2026, 0, i + 1).toISOString()));
    const out = mergeAnnouncements(many, []);
    expect(out).toHaveLength(20);
    expect(out[0]!.id).toBe("29");
  });
  it("handles empty lists", () => {
    expect(mergeAnnouncements([], [])).toEqual([]);
  });
});
