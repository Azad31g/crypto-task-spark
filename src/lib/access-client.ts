import { rawInitData } from "./azox-backend";
import { getAccessPolicy, submitLocation } from "./access.functions";
import type { GpsPolicy } from "./access-gate";

export function hasInitData(): boolean {
  return Boolean(rawInitData());
}

export async function fetchAccessPolicy(): Promise<GpsPolicy | null> {
  const initData = rawInitData();
  if (!initData) return null;
  try {
    const r = await Promise.race([
      getAccessPolicy({ data: { initData } }),
      new Promise<null>((res) => setTimeout(() => res(null), 6000)),
    ]);
    return r && r.ok ? { banned: r.banned, gps: r.gps } : null;
  } catch {
    return null;
  }
}

export async function sendLocation(loc: {
  latitude: number;
  longitude: number;
  horizontalAccuracy: number | null;
}): Promise<boolean> {
  const initData = rawInitData();
  if (!initData) return false;
  try {
    const r = await submitLocation({ data: { initData, ...loc } });
    return r.ok;
  } catch {
    return false;
  }
}
