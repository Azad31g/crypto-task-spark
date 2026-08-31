// AZOX wallet layer — transport-neutral environment detection and user-facing
// labels. This module is SSR-safe: it must NEVER import @reown/appkit or
// @metamask/connect-evm. The MetaMask Connect wagmi connector lives in the
// browser-only module `metamask-connect-connector.ts`.
import { isTelegramMiniApp } from "./telegram";

export const METAMASK_CONNECTOR_ID = "metaMaskSDK";

export type WalletEnvironment = "web" | "telegram-android" | "telegram-other";

function telegramPlatform(): string | null {
  if (typeof window === "undefined") return null;
  const webApp = window.Telegram?.WebApp as { platform?: string } | undefined;
  return webApp?.platform ?? null;
}

/**
 * True only inside a REAL Telegram Mini App running on Android.
 * Evidence order: Telegram's own reported platform, then the launch parameter
 * `tgWebAppPlatform`, then the Android user agent as a last resort — but always
 * gated behind `isTelegramMiniApp()` so ordinary Android browsers are excluded.
 */
export type WalletEnvironmentSignals = {
  /** Result of the strict Telegram Mini App runtime check. */
  isMiniApp: boolean;
  /** `Telegram.WebApp.platform`, when Telegram reports one. */
  platform?: string | null;
  /** `tgWebAppPlatform` launch parameter, when present. */
  launchPlatform?: string | null;
  userAgent?: string;
};

const ANDROID_PLATFORMS = new Set(["android", "android_x"]);

/** Pure, deterministic environment resolution — no DOM access. */
export function resolveWalletEnvironment(signals: WalletEnvironmentSignals): WalletEnvironment {
  if (!signals.isMiniApp) return "web";

  const platform = signals.platform;
  if (platform) {
    if (ANDROID_PLATFORMS.has(platform)) return "telegram-android";
    // A concrete non-Android platform (ios, tdesktop, web, macos...) is decisive.
    if (platform !== "unknown") return "telegram-other";
  }

  const launchPlatform = signals.launchPlatform;
  if (launchPlatform) {
    return ANDROID_PLATFORMS.has(launchPlatform) ? "telegram-android" : "telegram-other";
  }

  return /android/i.test(signals.userAgent ?? "") ? "telegram-android" : "telegram-other";
}

/** Which connection path the UI must offer as the primary action. */
export function primaryWalletTransport(env: WalletEnvironment): "metaMask" | "appKit" {
  return env === "telegram-android" ? "metaMask" : "appKit";
}

/**
 * Whether the official MetaMask Connect connector is registered for this
 * environment. It is registered ONLY inside a Telegram Android Mini App.
 */
export function metaMaskConnectAvailable(env: WalletEnvironment): boolean {
  return env === "telegram-android";
}

function launchPlatformParam(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(
    `${window.location.search.replace(/^\?/, "")}&${window.location.hash.replace(/^#/, "")}`,
  );
  return params.get("tgWebAppPlatform");
}

export function isTelegramAndroidMiniApp(): boolean {
  return detectWalletEnvironment() === "telegram-android";
}

export function detectWalletEnvironment(): WalletEnvironment {
  // SSR / worker: always the web-safe path, never MetaMask Connect.
  if (typeof window === "undefined") return "web";
  return resolveWalletEnvironment({
    isMiniApp: isTelegramMiniApp(),
    platform: telegramPlatform(),
    launchPlatform: launchPlatformParam(),
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
  });
}

export const WALLET_MODE_LABELS: Record<
  WalletEnvironment,
  { primary: string; secondary: string; hint: string }
> = {
  web: {
    primary: "Connect Wallet",
    secondary: "Other Wallets",
    hint: "Supports MetaMask, Trust Wallet, Phantom, Coinbase & more",
  },
  "telegram-android": {
    primary: "Connect with MetaMask",
    secondary: "Other Wallets",
    hint: "MetaMask uses the official MetaMask Connect link. Other wallets open through WalletConnect.",
  },
  "telegram-other": {
    primary: "Connect Wallet",
    secondary: "Other Wallets",
    hint: "Supports MetaMask, Trust Wallet, Phantom, Coinbase & more",
  },
};

