import { getCampusDateParts } from "@/lib/utils";

/**
 * Checks whether a professor currently has an active office-hours slot
 * by comparing campus day-of-week and clock time against each row in
 * professor_office_hours (shape: { day, start_time, end_time, location }).
 */
export function isProfessorInOffice(professor) {
  const { dayName: currentDay, timeString } = getCampusDateParts();
  const [hourPart, minutePart] = timeString.split(":").map(Number);
  const currentMinutes = hourPart * 60 + minutePart;

  const hours = professor?.professor_office_hours ?? [];
  return hours.some((oh) => {
    if (!oh.day || !oh.start_time || !oh.end_time) return false;
    if (oh.day !== currentDay) return false;

    const [startH, startM] = oh.start_time.split(":").map(Number);
    const [endH, endM] = oh.end_time.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  });
}

function addBuildingId(set, rawId) {
  if (rawId == null || rawId === "") return;
  const id = typeof rawId === "number" ? rawId : String(rawId);
  set.add(id);
}

function isActiveOfficeHour(oh, currentDay, currentMinutes) {
  if (!oh.day || !oh.start_time || !oh.end_time) return false;
  if (oh.day !== currentDay) return false;

  const [startH, startM] = oh.start_time.split(":").map(Number);
  const [endH, endM] = oh.end_time.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Returns a Set of building IDs that currently have at least one professor
 * actively holding office hours (i.e., right now).
 * Prefers relational professor.building_id; falls back to fuzzy location matching only when building_id is absent.
 */
export function getActiveBuildingIds(professors, buildings) {
  const ids = new Set();
  const { dayName: currentDay, timeString } = getCampusDateParts();
  const [hourPart, minutePart] = timeString.split(":").map(Number);
  const currentMinutes = hourPart * 60 + minutePart;

  for (const prof of professors) {
    const hours = prof?.professor_office_hours ?? [];
    for (const oh of hours) {
      if (!isActiveOfficeHour(oh, currentDay, currentMinutes)) continue;

      if (prof.building_id != null && prof.building_id !== "") {
        addBuildingId(ids, prof.building_id);
        break;
      }

      if (!oh.location) continue;
      const building = matchBuildingFromLocation(oh.location, buildings);
      if (building?.id != null) addBuildingId(ids, building.id);
    }
  }
  return ids;
}

/**
 * Fuzzy fallback when professor.building_id is unavailable (e.g. legacy rows).
 * Used by ProfessorCard locate UX only — not for live-mode map highlighting.
 */
export function matchBuildingFromLocation(location, buildings) {
  if (!location || !buildings?.length) return null;
  const loc = location.toLowerCase();
  return (
    buildings.find((b) => {
      const name = (b.name ?? "").toLowerCase();
      if (!name) return false;
      const firstWord = loc.split(/[\s,]/)[0];
      return loc.includes(name) || (name.length > 3 && name.includes(firstWord));
    }) ?? null
  );
}
