import { describe, expect, it } from "vitest";
import { Buffer } from "buffer/index.js";
import { ensureBrowserBuffer } from "./browser-buffer";

describe("ensureBrowserBuffer", () => {
  it("installs a Buffer implementation with a working from method", () => {
    const browserGlobal: { Buffer?: typeof Buffer } = {};

    const installed = ensureBrowserBuffer(browserGlobal);

    expect(browserGlobal.Buffer).toBe(Buffer);
    expect(installed.from("AZOX").toString("utf8")).toBe("AZOX");
  });

  it("does not replace an existing compatible Buffer global", () => {
    const browserGlobal = { Buffer };

    expect(ensureBrowserBuffer(browserGlobal)).toBe(Buffer);
    expect(browserGlobal.Buffer).toBe(Buffer);
  });
});
