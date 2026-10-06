import { describe, expect, it } from "vitest";
import { canSeeStory } from "./story-visibility";

describe("canSeeStory", () => {
  it("public is always visible", () => {
    expect(canSeeStory({ isPrivate: false, userId: null, isAdmin: false, recipients: [] })).toBe(
      true,
    );
  });
  it("private only for recipients", () => {
    expect(canSeeStory({ isPrivate: true, userId: 1, isAdmin: false, recipients: [1] })).toBe(true);
    expect(
      canSeeStory({ isPrivate: true, userId: 2, isAdmin: false, recipients: new Set([1]) }),
    ).toBe(false);
  });
  it("admin sees all", () => {
    expect(canSeeStory({ isPrivate: true, userId: 9, isAdmin: true, recipients: [] })).toBe(true);
  });
  it("unknown user sees no private", () => {
    expect(canSeeStory({ isPrivate: true, userId: null, isAdmin: false, recipients: [1] })).toBe(
      false,
    );
  });
});
