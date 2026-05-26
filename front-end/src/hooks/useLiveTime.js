import { useState, useEffect } from "react";

/**
 * Forces a component re-render on a fixed interval so that time-dependent
 * UI (e.g. "open now" badges) stays in sync with the real-world clock.
 *
 * Returns a UTC `Date` instant. Pass it to `getCampusDateParts(now)` from
 * `@/lib/utils` for Dickinson campus (America/New_York) day/time.
 *
 * @param {number} refreshInterval - milliseconds between ticks (default 60 s)
 * @returns {Date}
 */
export function useLiveTime(refreshInterval = 60_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), refreshInterval);
    return () => clearInterval(id);
  }, [refreshInterval]);

  return now;
}
