export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
};

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  initData?: string;
  initDataUnsafe?: { user?: TelegramUser; start_param?: string };
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  HapticFeedback?: { impactOccurred: (style: string) => void };
};

type TelegramBridgeWindow = Window & {
  TelegramWebviewProxy?: unknown;
  TelegramWebviewProxyProto?: unknown;
  Telegram?: {
    WebApp?: TelegramWebApp;
    WebView?: { initParams?: Record<string, unknown> };
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function isTelegram(): boolean {
  if (typeof window === "undefined") return false;
  const hasWebApp = Boolean(window.Telegram?.WebApp);
  const hasInitData = Boolean(window.Telegram?.WebApp?.initData);
  const hasUser = Boolean(window.Telegram?.WebApp?.initDataUnsafe?.user);
  console.log("[telegram] isTelegram check:", { hasWebApp, hasInitData, hasUser });
  return hasWebApp && (hasInitData || hasUser);
}

// Strict runtime detection of a real Telegram Mini App/WebView.
// telegram-web-app.js defines window.Telegram in ANY browser, so presence of
// the object alone is a false positive. A genuine Mini App session always has
// initData / an initDataUnsafe user, or a concrete non-"unknown" platform.
export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  const bridgeWindow = window as TelegramBridgeWindow;
  if (
    bridgeWindow.TelegramWebviewProxy ||
    bridgeWindow.TelegramWebviewProxyProto
  ) {
    return true;
  }

  // The official Telegram SDK reads launch parameters from the URL once and
  // persists them under this sessionStorage key. After a wallet round-trip the
  // URL may no longer contain tgWebApp* parameters, while this remains the
  // authoritative signal that the page belongs to the same Mini App session.
  try {
    const storedParams = window.sessionStorage.getItem("__telegram__initParams");
    if (storedParams) {
      const parsed = JSON.parse(storedParams) as Record<string, unknown>;
      if (
        parsed["tgWebAppData"] ||
        parsed["tgWebAppVersion"] ||
        parsed["tgWebAppPlatform"]
      ) {
        return true;
      }
    }
  } catch {
    // Storage can be unavailable in restricted WebViews; continue with the
    // SDK's in-memory launch parameters below.
  }

  const sdkParams = bridgeWindow.Telegram?.WebView?.initParams;
  if (
    sdkParams?.["tgWebAppData"] ||
    sdkParams?.["tgWebAppVersion"] ||
    sdkParams?.["tgWebAppPlatform"]
  ) {
    return true;
  }

  // Telegram injects these launch parameters into the URL before its SDK has
  // necessarily finished loading. Checking them keeps the first client render
  // from briefly exposing wallet actions inside the Android WebView.
  const launchParams = new URLSearchParams(
    `${window.location.search.replace(/^\?/, "")}&${window.location.hash.replace(/^#/, "")}`,
  );
  if (
    launchParams.has("tgWebAppData") ||
    launchParams.has("tgWebAppVersion") ||
    launchParams.has("tgWebAppPlatform")
  ) {
    return true;
  }

  const webApp = window.Telegram?.WebApp as
    | (TelegramWebApp & { platform?: string })
    | undefined;
  if (!webApp) return false;
  if (webApp.initData) return true;
  if (webApp.initDataUnsafe?.user) return true;
  const platform = webApp.platform;
  return Boolean(platform && platform !== "unknown");
}

export function getTelegramUser(): TelegramUser | null {
  if (typeof window === "undefined") return null;

  // Method 1: standard initDataUnsafe
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (user && user.id) return user;

  // Method 2: parse initData string manually
  try {
    const initData = window.Telegram?.WebApp?.initData;
    if (initData) {
      const params = new URLSearchParams(initData);
      const userStr = params.get("user");
      if (userStr) {
        const parsed = JSON.parse(decodeURIComponent(userStr));
        if (parsed?.id) return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }

  return null;
}

export function getStartParam(): string | null {
  return getWebApp()?.initDataUnsafe?.start_param ?? null;
}

export function expandApp(): void {
  const app = getWebApp();
  if (!app) return;
  try {
    app.expand();
  } catch {
    // ignore — not running inside Telegram
  }
}

export function initTelegram(): TelegramUser | null {
  const app = getWebApp();
  console.log("[telegram] window.Telegram:", typeof window !== "undefined" ? window.Telegram : "SSR");
  console.log("[telegram] WebApp:", app);
  console.log("[telegram] initDataUnsafe:", app?.initDataUnsafe);
  console.log("[telegram] user:", app?.initDataUnsafe?.user);
  if (!app) return null;
  try {
    app.ready();
    app.expand();
    app.setBackgroundColor?.("#000000");
    app.setHeaderColor?.("#000000");
  } catch {
    // ignore
  }
  return getTelegramUser();
}

export function haptic(style = "light"): void {
  try {
    getWebApp()?.HapticFeedback?.impactOccurred(style);
  } catch {
    // ignore
  }
}
