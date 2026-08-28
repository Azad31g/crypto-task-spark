import { useCallback, useEffect, useRef, useState } from "react";
import { useAzox } from "@/components/azox/app-provider";
import { haptic } from "@/lib/telegram";
import {
  BOXES_PER_DAY,
  BOX_REWARD,
  MAX_WINNERS,
  SESSION_SECONDS,
  countAppeared,
  dateKey,
  getCurrentSession,
  getSchedule,
  readNumber,
  readOpened,
  secondsFromMidnight,
} from "@/lib/azox-box-schedule";

export {
  BOXES_PER_DAY,
  BOX_REWARD,
  MAX_WINNERS,
  SESSION_SECONDS,
  dateKey,
  generateDailySchedule,
  getCurrentSession,
  getSchedule,
} from "@/lib/azox-box-schedule";

export function useAzoxBox() {
  const { addPoints } = useAzox();
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [schedule, setSchedule] = useState<number[]>([]);
  const [opened, setOpened] = useState<number[]>([]);
  const [winners, setWinners] = useState(0);
  const [pointsToday, setPointsToday] = useState(0);
  const [justOpened, setJustOpened] = useState(false);
  const busy = useRef(false);

  // Tick + midnight rollover
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow(d);
      const key = dateKey(d);
      setToday((prev) => (prev === key ? prev : key));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setSchedule(getSchedule(today));
    setOpened(readOpened(today));
    setWinners(readNumber("azoxBox_winners"));
    setPointsToday(readNumber(`azoxBox_lastPoints_${today}`));
    setHydrated(true);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    getSchedule(dateKey(tomorrow));
  }, [today]);

  const secs = secondsFromMidnight(now);
  const sessionIndex = schedule.length ? getCurrentSession(schedule, secs) : null;
  const hasOpened = sessionIndex !== null && opened.includes(sessionIndex);
  const spotsLeft = Math.max(0, MAX_WINNERS - winners);
  const isActive = sessionIndex !== null && spotsLeft > 0;

  const secondsRemaining =
    sessionIndex === null ? 0 : schedule[sessionIndex]! + SESSION_SECONDS - secs;

  // Missed: a session closed within the last 5 minutes and wasn't opened
  const lastPassed = (() => {
    let idx = -1;
    for (let i = 0; i < schedule.length; i++) {
      if (schedule[i]! + SESSION_SECONDS <= secs) idx = i;
    }
    return idx;
  })();
  const missedRecently =
    lastPassed >= 0 && secs - (schedule[lastPassed]! + SESSION_SECONDS) < 300;
  const missed = !isActive && missedRecently && !opened.includes(lastPassed);

  useEffect(() => {
    if (sessionIndex === null) setJustOpened(false);
  }, [sessionIndex]);

  const openBox = useCallback(() => {
    if (busy.current) return;
    const d = new Date();
    const s = secondsFromMidnight(d);
    const key = dateKey(d);
    const sched = getSchedule(key);
    const idx = getCurrentSession(sched, s);
    if (idx === null) return;
    const already = readOpened(key);
    if (already.includes(idx)) return;
    const w = readNumber("azoxBox_winners");
    if (w >= MAX_WINNERS) return;

    busy.current = true;
    const nextOpened = [...already, idx];
    window.localStorage.setItem(`azoxBox_opened_${key}`, JSON.stringify(nextOpened));
    window.localStorage.setItem("azoxBox_winners", String(w + 1));
    const pts = readNumber(`azoxBox_lastPoints_${key}`) + BOX_REWARD;
    window.localStorage.setItem(`azoxBox_lastPoints_${key}`, String(pts));
    window.localStorage.setItem("azoxBox_lastPoints", String(pts));

    setOpened(nextOpened);
    setWinners(w + 1);
    setPointsToday(pts);
    setJustOpened(true);
    addPoints(BOX_REWARD);
    haptic("medium");
    window.setTimeout(() => {
      busy.current = false;
    }, 600);
  }, [addPoints]);

  return {
    hydrated,
    schedule,
    isActive,
    hasOpened,
    justOpened,
    missed,
    sessionIndex,
    secondsRemaining: Math.max(0, secondsRemaining),
    spotsLeft,
    appearedToday: schedule.length ? countAppeared(schedule, secs) : 0,
    openedCount: opened.length,
    pointsToday,
    openBox,
  };
}
