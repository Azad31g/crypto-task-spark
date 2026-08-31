import { describe, expect, it } from "vitest";
import {
  metaMaskConnectAvailable,
  primaryWalletTransport,
  resolveWalletEnvironment,
} from "./azox-wallet-layer";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

describe("resolveWalletEnvironment", () => {
  it("routes a Telegram Android Mini App to the MetaMask path", () => {
    expect(
      resolveWalletEnvironment({
        isMiniApp: true,
        platform: "android",
        userAgent: ANDROID_UA,
      }),
    ).toBe("telegram-android");
    expect(resolveWalletEnvironment({ isMiniApp: true, platform: "android_x" })).toBe(
      "telegram-android",
    );
  });

  it("keeps Telegram iOS and desktop on AppKit", () => {
    for (const platform of ["ios", "tdesktop", "macos", "weba", "web"]) {
      expect(resolveWalletEnvironment({ isMiniApp: true, platform })).toBe("telegram-other");
    }
  });

  it("never misclassifies an ordinary mobile browser as Telegram", () => {
    for (const userAgent of [ANDROID_UA, IPHONE_UA]) {
      expect(
        resolveWalletEnvironment({
          isMiniApp: false,
          platform: "android",
          userAgent,
        }),
      ).toBe("web");
    }
  });

  it("falls back to the launch parameter when the platform is unknown", () => {
    expect(
      resolveWalletEnvironment({
        isMiniApp: true,
        platform: "unknown",
        launchPlatform: "android",
        userAgent: IPHONE_UA,
      }),
    ).toBe("telegram-android");
    expect(
      resolveWalletEnvironment({
        isMiniApp: true,
        platform: "unknown",
        launchPlatform: "ios",
        userAgent: ANDROID_UA,
      }),
    ).toBe("telegram-other");
  });

  it("uses the user agent only as a last resort inside a Mini App", () => {
    expect(resolveWalletEnvironment({ isMiniApp: true, userAgent: ANDROID_UA })).toBe(
      "telegram-android",
    );
    expect(resolveWalletEnvironment({ isMiniApp: true, userAgent: IPHONE_UA })).toBe(
      "telegram-other",
    );
  });

  it("treats a server render as the web-safe environment", () => {
    expect(resolveWalletEnvironment({ isMiniApp: false })).toBe("web");
  });
});

describe("primaryWalletTransport", () => {
  it("selects MetaMask Connect only on Telegram Android", () => {
    expect(primaryWalletTransport("telegram-android")).toBe("metaMask");
    expect(primaryWalletTransport("telegram-other")).toBe("appKit");
    expect(primaryWalletTransport("web")).toBe("appKit");
  });
});

describe("metaMaskConnectAvailable", () => {
  it("registers MetaMask Connect only inside a Telegram Android Mini App", () => {
    expect(metaMaskConnectAvailable("telegram-android")).toBe(true);
    expect(metaMaskConnectAvailable("telegram-other")).toBe(false);
    expect(metaMaskConnectAvailable("web")).toBe(false);
  });

  it("matches the primary transport decision for every environment", () => {
    for (const env of ["web", "telegram-android", "telegram-other"] as const) {
      expect(metaMaskConnectAvailable(env)).toBe(primaryWalletTransport(env) === "metaMask");
    }
  });
});

describe("launch-parameter and unknown-platform handling", () => {
  it("treats android_x from the launch parameter as Telegram Android", () => {
    expect(
      resolveWalletEnvironment({
        isMiniApp: true,
        platform: "unknown",
        launchPlatform: "android_x",
      }),
    ).toBe("telegram-android");
  });

  it("uses the Android user agent when the platform is unknown and no launch parameter exists", () => {
    expect(
      resolveWalletEnvironment({
        isMiniApp: true,
        platform: "unknown",
        userAgent: ANDROID_UA,
      }),
    ).toBe("telegram-android");
  });

  it("stays web-safe when nothing but a launch parameter is present outside a Mini App", () => {
    expect(
      resolveWalletEnvironment({
        isMiniApp: false,
        launchPlatform: "android",
        userAgent: ANDROID_UA,
      }),
    ).toBe("web");
  });
});
