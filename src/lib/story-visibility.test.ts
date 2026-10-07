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

import { resolveStoryMedia } from "./story-visibility";
describe("resolveStoryMedia", () => {
  const ok = async (p: string) => `https://signed/${p}`;
  it("signs private stories", async () => {
    expect(await resolveStoryMedia({ isPrivate: true, mediaUrl: "", mediaPath: "a.jpg" }, ok)).toBe(
      "https://signed/a.jpg",
    );
  });
  it("excludes private on sign failure or missing path", async () => {
    const bad = async () => null;
    const boom = async (): Promise<string | null> => {
      throw new Error("x");
    };
    expect(
      await resolveStoryMedia({ isPrivate: true, mediaUrl: "https://pub", mediaPath: "a" }, bad),
    ).toBeNull();
    expect(
      await resolveStoryMedia({ isPrivate: true, mediaUrl: "", mediaPath: "a" }, boom),
    ).toBeNull();
    expect(
      await resolveStoryMedia({ isPrivate: true, mediaUrl: "https://pub", mediaPath: null }, ok),
    ).toBeNull();
  });
  it("leaves public stories untouched", async () => {
    let called = false;
    const spy = async () => ((called = true), "x");
    expect(
      await resolveStoryMedia(
        { isPrivate: false, mediaUrl: "https://pub/x", mediaPath: null },
        spy,
      ),
    ).toBe("https://pub/x");
    expect(called).toBe(false);
  });
});
