import { describe, expect, it } from "vitest";
import { matchesPerson, normalize, sortByTime } from "./story-insights-filter";

describe("story insights search", () => {
  const person = { name: "Hawré", username: "@Hawre_7", body: "unsearchable comment" };
  it("normalizes case, spaces, Latin and Arabic/Kurdish combining marks", () => {
    expect(normalize("  HÁWRÊ  ")).toBe("hawre");
    expect(normalize("هَاوڕێ")).toBe(normalize("هاوڕێ"));
  });
  it("matches partial names and usernames, including digits and leading @", () => {
    for (const query of ["ha", "HA", "hawre", "@HAWRE", "  @ha  ", "7", "ré"])
      expect(matchesPerson(person, query)).toBe(true);
  });
  it("matches empty queries and handles missing usernames", () => {
    for (const query of ["", "  ", "@"])
      expect(matchesPerson(person, query)).toBe(true);
    expect(matchesPerson({ name: "Azad", username: null }, "aza")).toBe(true);
    expect(matchesPerson({ name: "Azad", username: null }, "7")).toBe(false);
  });
  it("ignores comment text and matches Arabic diacritics", () => {
    expect(matchesPerson(person, "unsearchable")).toBe(false);
    expect(matchesPerson({ name: "هَاوڕێ", username: null }, "هاوڕێ")).toBe(true);
  });
  it("sorts both directions without mutating the original list", () => {
    const rows = [{ time: "2026-10-06T10:32:00Z" }, { time: "2026-10-05T10:32:00Z" }];
    expect(sortByTime(rows, "newest")).toEqual(rows);
    expect(sortByTime(rows, "oldest")).toEqual([rows[1], rows[0]]);
    expect(rows[0].time).toBe("2026-10-06T10:32:00Z");
    expect(sortByTime([], "newest")).toEqual([]);
  });
});