import { useEffect, useState } from "react";
import { startOfToday } from "date-fns";

function getTodayDate() {
  return startOfToday();
}

function getMillisecondsUntilNextLocalMidnight(now: Date) {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(1, nextMidnight.getTime() - now.getTime());
}

export function useTodayDate() {
  const [today, setToday] = useState(() => getTodayDate());

  useEffect(() => {
    const now = new Date();
    const timeout = window.setTimeout(() => {
      setToday(getTodayDate());
    }, getMillisecondsUntilNextLocalMidnight(now));

    return () => {
      window.clearTimeout(timeout);
    };
  }, [today]);

  return today;
}
