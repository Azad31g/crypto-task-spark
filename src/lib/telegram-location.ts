import { getWebApp } from "./telegram";

// Thin, never-throwing wrappers over Telegram WebApp.LocationManager (Bot API 8.0+).
type LocationData = { latitude: number; longitude: number; horizontal_accuracy?: number | null };
type LocationManager = {
  isInited?: boolean;
  isLocationAvailable?: boolean;
  isAccessRequested?: boolean;
  isAccessGranted?: boolean;
  init: (cb?: () => void) => void;
  getLocation: (cb: (data: LocationData | null) => void) => void;
  openSettings: () => void;
};
type WebAppExt = {
  LocationManager?: LocationManager;
  isVersionAtLeast?: (v: string) => boolean;
  onEvent?: (e: string, cb: () => void) => void;
  offEvent?: (e: string, cb: () => void) => void;
};

function lm(): LocationManager | null {
  try {
    return ((getWebApp() as unknown as WebAppExt | null)?.LocationManager ?? null) || null;
  } catch {
    return null;
  }
}

export function isLocationSupported(): boolean {
  try {
    const app = getWebApp() as unknown as WebAppExt | null;
    return Boolean(app?.LocationManager && app.isVersionAtLeast?.("8.0"));
  } catch {
    return false;
  }
}

export function initLocationManager(): Promise<boolean> {
  return new Promise((resolve) => {
    const m = lm();
    if (!m) return resolve(false);
    if (m.isInited) return resolve(true);
    const t = setTimeout(() => resolve(false), 5000);
    try {
      m.init(() => {
        clearTimeout(t);
        resolve(true);
      });
    } catch {
      clearTimeout(t);
      resolve(false);
    }
  });
}

export function getLocationState() {
  const m = lm();
  return {
    available: Boolean(m?.isLocationAvailable),
    requested: Boolean(m?.isAccessRequested),
    granted: Boolean(m?.isAccessGranted),
  };
}

export function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
  horizontalAccuracy: number | null;
} | null> {
  return new Promise((resolve) => {
    const m = lm();
    if (!m) return resolve(null);
    const t = setTimeout(() => resolve(null), 20000);
    try {
      m.getLocation((d) => {
        clearTimeout(t);
        if (!d || typeof d.latitude !== "number" || typeof d.longitude !== "number")
          return resolve(null);
        const acc = d.horizontal_accuracy;
        resolve({
          latitude: d.latitude,
          longitude: d.longitude,
          horizontalAccuracy: typeof acc === "number" && Number.isFinite(acc) ? acc : null,
        });
      });
    } catch {
      clearTimeout(t);
      resolve(null);
    }
  });
}

export function openLocationSettings(): void {
  try {
    lm()?.openSettings();
  } catch {
    // ignore
  }
}

export function onLocationManagerUpdated(cb: () => void): () => void {
  try {
    const app = getWebApp() as unknown as WebAppExt | null;
    app?.onEvent?.("locationManagerUpdated", cb);
    return () => {
      try {
        app?.offEvent?.("locationManagerUpdated", cb);
      } catch {
        // ignore
      }
    };
  } catch {
    return () => {};
  }
}
