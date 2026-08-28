import { useEffect, useState } from "react";
import {
  dateKey,
  getCurrentSession,
  getSchedule,
  readOpened,
  secondsFromMidnight,
  SESSION_SECONDS,
} from "@/lib/azox-box-schedule";

export type BoxAlert = {
  isBoxOpen: boolean;
  secondsRemaining: number;
  alreadyOpened: boolean;
};

/** Polls the local box schedule every 10s so any page can surface an open box. */
export function useBoxAlert(): BoxAlert {
  const [state, setState] = useState<BoxAlert>({
    isBoxOpen: false,
    secondsRemaining: 0,
    alreadyOpened: false,
  });

  useEffect(() => {
    const check = () => {
      const d = new Date();
      const key = dateKey(d);
      const secs = secondsFromMidnight(d);
      const schedule = getSchedule(key);
      const idx = getCurrentSession(schedule, secs);
      if (idx === null) {
        setState({ isBoxOpen: false, secondsRemaining: 0, alreadyOpened: false });
        return;
      }
      setState({
        isBoxOpen: true,
        secondsRemaining: Math.max(0, schedule[idx]! + SESSION_SECONDS - secs),
        alreadyOpened: readOpened(key).includes(idx),
      });
    };

    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, []);

  return state;
}
