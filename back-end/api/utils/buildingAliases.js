/**
 * Canonical building names and scraped-string aliases for strict FK resolution.
 *
 * Names must match back-end/api/data/data.json / Supabase buildings.name exactly.
 * Source of truth: pipeline_worker/pipeline_worker/building_aliases.py
 */

const CANONICAL_BUILDING_NAMES = new Set([
  'Waidner-Spahr Library',
  'Althouse Hall',
  'Rector Science Complex',
  'Kline Fitness Center',
  'Bosler Hall',
  'Holland Union Building (HUB)',
  'Denny Hall',
  'East College',
  'Denim Coffee at the Quarry',
  'Tome Hall',
  'Anita Tuvin Schlechter Auditorium (ATS)',
  'Kaufman Hall / Stafford Greenhouse',
  'Weiss Arts Center',
  'Stern Center for Global Education',
  'Montgomery Hall',
  'Landis House',
  'Keck Archaeology Laboratory',
  'ROTC Building',
  'Educational Studies Department Building',
]);

/** Scraped / shorthand strings -> canonical buildings.name */
const BUILDING_ALIASES = {
  Tome: 'Tome Hall',
  'Tome Scientific Building': 'Tome Hall',
  'Tome Hall': 'Tome Hall',
  Rector: 'Rector Science Complex',
  'Rector Science Complex': 'Rector Science Complex',
  'Weiss Arts Center': 'Weiss Arts Center',
  'Emil R. Weiss Center for the Arts': 'Weiss Arts Center',
  'Weiss Center for the Arts': 'Weiss Arts Center',
  'Holland Union Building': 'Holland Union Building (HUB)',
  'Holland Union Building (HUB)': 'Holland Union Building (HUB)',
  HUB: 'Holland Union Building (HUB)',
  'Kaufman Hall': 'Kaufman Hall / Stafford Greenhouse',
  'Stafford Greenhouse': 'Kaufman Hall / Stafford Greenhouse',
  'Kaufman Hall / Stafford Greenhouse': 'Kaufman Hall / Stafford Greenhouse',
  'Waidner-Spahr Library': 'Waidner-Spahr Library',
  'Waidner Library': 'Waidner-Spahr Library',
  'Spahr Library': 'Waidner-Spahr Library',
  'Althouse Hall': 'Althouse Hall',
  Althouse: 'Althouse Hall',
  'Bosler Hall': 'Bosler Hall',
  Bosler: 'Bosler Hall',
  'Denny Hall': 'Denny Hall',
  Denny: 'Denny Hall',
  'East College': 'East College',
  'Montgomery Hall': 'Montgomery Hall',
  Montgomery: 'Montgomery Hall',
  'Landis House': 'Landis House',
  Landis: 'Landis House',
  'Stern Center for Global Education': 'Stern Center for Global Education',
  'Stern Center': 'Stern Center for Global Education',
  'Anita Tuvin Schlechter Auditorium (ATS)': 'Anita Tuvin Schlechter Auditorium (ATS)',
  'Anita Tuvin Schlechter Auditorium': 'Anita Tuvin Schlechter Auditorium (ATS)',
  ATS: 'Anita Tuvin Schlechter Auditorium (ATS)',
  'Keck Archaeology Laboratory': 'Keck Archaeology Laboratory',
  Keck: 'Keck Archaeology Laboratory',
  'ROTC Building': 'ROTC Building',
  ROTC: 'ROTC Building',
  'Educational Studies Department Building': 'Educational Studies Department Building',
  'Educational Studies Building': 'Educational Studies Department Building',
  'Kline Fitness Center': 'Kline Fitness Center',
  Kline: 'Kline Fitness Center',
  'Denim Coffee at the Quarry': 'Denim Coffee at the Quarry',
  Denim: 'Denim Coffee at the Quarry',
};

function normalizeKey(value) {
  return value.split(/\s+/).filter(Boolean).join(' ').toLowerCase();
}

const aliasLookup = new Map();
for (const [alias, canonical] of Object.entries(BUILDING_ALIASES)) {
  aliasLookup.set(normalizeKey(alias), canonical);
}
for (const name of CANONICAL_BUILDING_NAMES) {
  aliasLookup.set(normalizeKey(name), name);
}

/**
 * Map a scraped building string to an exact canonical buildings.name.
 * @returns {string|null}
 */
function resolveCanonicalBuildingName(raw) {
  if (raw == null) return null;
  const stripped = String(raw).trim();
  if (!stripped) return null;
  return aliasLookup.get(normalizeKey(stripped)) ?? null;
}

module.exports = {
  BUILDING_ALIASES,
  CANONICAL_BUILDING_NAMES,
  resolveCanonicalBuildingName,
};
