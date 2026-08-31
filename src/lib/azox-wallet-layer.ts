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
export function isTelegramAndroidMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  if (!isTelegramMiniApp()) return false;

  const platform = telegramPlatform();
  if (platform) {
    if (platform === "android" || platform === "android_x") return true;
    // A concrete non-Android platform (ios, tdesktop, web, macos...) is decisive.
    if (platform !== "unknown") return false;
  }

  const launchParams = new URLSearchParams(
    `${window.location.search.replace(/^\?/, "")}&${window.location.hash.replace(/^#/, "")}`,
  );
  const launchPlatform = launchParams.get("tgWebAppPlatform");
  if (launchPlatform) {
    return launchPlatform === "android" || launchPlatform === "android_x";
  }

  return /android/i.test(navigator.userAgent);
}

export function detectWalletEnvironment(): WalletEnvironment {
  if (typeof window === "undefined") return "web";
  if (!isTelegramMiniApp()) return "web";
  return isTelegramAndroidMiniApp() ? "telegram-android" : "telegram-other";
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

/**
 * Explicit, user-initiated fallback: opens the AZOX HTTPS URL in the external
 * browser through Telegram's documented `WebApp.openLink`. This bridge is used
 * ONLY for this HTTPS AZOX URL — never for wallet deep links, which AppKit /
 * MetaMask Connect own themselves. Never call this automatically.
 */
export function openAzoxInExternalBrowser(): void {
  if (typeof window === "undefined") return;
  const url = window.location.href;
  const webApp = window.Telegram?.WebApp as
    { openLink?: (u: string, o?: { try_instant_view?: boolean }) => void } | undefined;
  if (webApp?.openLink) {
    webApp.openLink(url, { try_instant_view: false });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
