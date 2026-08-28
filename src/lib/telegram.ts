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
