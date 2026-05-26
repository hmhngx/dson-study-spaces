import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Dickinson campus timezone — all open/closed logic uses this, not local TZ. */
export const CAMPUS_TIMEZONE = "America/New_York";

/**
 * Day-of-week and clock parts for campus time (ET), from a UTC instant.
 *
 * @param {Date} [date] - injectable for tests; defaults to `new Date()`
 * @returns {{ dayName: string, timeString: string, hour: number }}
 */
export function getCampusDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TIMEZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    dayName: parts.weekday,
    timeString: `${parts.hour}:${parts.minute}`,
    hour: Number(parts.hour),
  };
}

/**
 * Compares two "HH:MM" time strings lexicographically.
 * Returns true if `a` is <= `b`.
 */
function timeLE(a, b) {
  return a <= b;
}

/**
 * Determines whether a building is open at a specific day and time.
 *
 * @param {Record<string, [string, string]> | null} hoursJson
 *   e.g. { Monday: ["08:00", "23:59"], ... }
 * @param {string} dayOfWeek - Full day name e.g. "Monday"
 * @param {string} timeString24h - Zero-padded "HH:MM" time string
 * @returns {boolean}
 */
export function isBuildingOpenAtTime(hoursJson, dayOfWeek, timeString24h) {
  if (!hoursJson || typeof hoursJson !== "object") return false;

  const dayHours = hoursJson[dayOfWeek];
  if (!Array.isArray(dayHours) || dayHours.length < 2) return false;

  const [startTime, endTime] = dayHours;
  return timeLE(startTime, timeString24h) && timeLE(timeString24h, endTime);
}

/**
 * Determines whether a building is currently open (Dickinson campus time).
 *
 * @param {Record<string, [string, string]> | null} hoursJson
 *   e.g. { Monday: ["08:00", "23:59"], Tuesday: ["08:00", "22:00"], ... }
 * @param {Date} [now] - injectable UTC instant; evaluated in America/New_York
 * @returns {boolean}
 */
export function checkIsOpenNow(hoursJson, now = new Date()) {
  if (!hoursJson || typeof hoursJson !== "object") return false;

  const { dayName, timeString } = getCampusDateParts(now);
  const todayHours = hoursJson[dayName];

  if (!Array.isArray(todayHours) || todayHours.length < 2) return false;

  const [startTime, endTime] = todayHours;

  // "23:59" is used to represent "open until midnight".
  return timeLE(startTime, timeString) && timeLE(timeString, endTime);
}
