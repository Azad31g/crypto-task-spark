import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { decideGate, type GpsPolicy } from "@/lib/access-gate";
import { fetchAccessPolicy, hasInitData, sendLocation } from "@/lib/access-client";
import {
  getCurrentLocation,
  getLocationState,
  initLocationManager,
  isLocationSupported,
  onLocationManagerUpdated,
  openLocationSettings,
} from "@/lib/telegram-location";

const POLICY_REFRESH_MS = 5 * 60 * 1000;
const CLIENT_SEND_MS = 10 * 60 * 1000;

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      {children}
    </div>
  );
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false); // Telegram + initData
  const [policy, setPolicy] = useState<GpsPolicy | null>(null);
  const [resolved, setResolved] = useState(false);
  const [supported, setSupported] = useState(true);
  const [locationOk, setLocationOk] = useState<boolean | null>(null);
  const policyAt = useRef(0);
  const lastSent = useRef(0);
  const running = useRef(false);

  const loadPolicy = useCallback(async () => {
    policyAt.current = Date.now();
    const p = await fetchAccessPolicy();
    setPolicy(p);
    setResolved(true);
  }, []);

  useEffect(() => {
    if (!hasInitData()) return;
    setActive(true);
    void loadPolicy();
  }, [loadPolicy]);

  const trySend = useCallback(async (loc: Parameters<typeof sendLocation>[0]) => {
    if (Date.now() - lastSent.current < CLIENT_SEND_MS) return;
    lastSent.current = Date.now();
    void sendLocation(loc).catch(() => {});
  }, []);

  // Runs the location flow for 'optional' (background) or 'required' (gating).
  const runLocation = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      if (!isLocationSupported()) {
        setSupported(false);
        return;
      }
      const inited = await initLocationManager();
      if (!inited || !getLocationState().available) {
        setSupported(false);
        return;
      }
      setSupported(true);
      const loc = await getCurrentLocation();
      if (loc) {
        setLocationOk(true);
        void trySend(loc);
      } else {
        setLocationOk(false);
      }
    } catch {
      setLocationOk(false);
    } finally {
      running.current = false;
    }
  }, [trySend]);

  const gps = policy && !policy.banned ? policy.gps : "off";

  useEffect(() => {
    if (gps === "off") return;
    if (gps === "required") setLocationOk(null);
    void runLocation();
  }, [gps, runLocation]);

  useEffect(() => {
    if (!active) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - policyAt.current > POLICY_REFRESH_MS) void loadPolicy();
      if (gps === "required") void runLocation();
      else if (gps === "optional" && Date.now() - lastSent.current >= CLIENT_SEND_MS)
        void runLocation();
    };
    document.addEventListener("visibilitychange", onVisible);
    const off =
      gps === "required"
        ? onLocationManagerUpdated(() => {
            void runLocation();
          })
        : () => {};
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      off();
    };
  }, [active, gps, loadPolicy, runLocation]);

  if (!active) return <>{children}</>;
  if (!resolved) {
    return (
      <FullScreen>
        <p className="text-sm text-muted-foreground">Loading AZOX…</p>
      </FullScreen>
    );
  }

  const decision = decideGate({ policy, supported, locationOk });
  if (decision === "banned") {
    return (
      <FullScreen>
        <p className="text-base font-semibold">This account is not allowed to use AZOX.</p>
      </FullScreen>
    );
  }
  if (decision === "locating") {
    return (
      <FullScreen>
        <p className="text-sm text-muted-foreground">Loading AZOX…</p>
      </FullScreen>
    );
  }
  if (decision === "blocked") {
    return (
      <FullScreen>
        <p className="text-base font-semibold">Location access is required to use AZOX.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => openLocationSettings()}>
            Open settings
          </Button>
          <Button
            onClick={() => {
              setLocationOk(null);
              void runLocation();
            }}
          >
            Try again
          </Button>
        </div>
      </FullScreen>
    );
  }
  return <>{children}</>;
}
