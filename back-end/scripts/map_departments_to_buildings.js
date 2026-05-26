require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1: STATIC MAPPING — Academic Departments → Primary Buildings
// Sourced from: "Comprehensive Spatial and Institutional Mapping of Academic
// Departments at Dickinson College" (PDF, March 2026).
// Departments listed as "Uncertain / Decentralized" in the PDF are omitted
// (they will surface in the unmatchedDepartments audit log).
// ─────────────────────────────────────────────────────────────────────────────
const departmentMapping = {
  // Humanities — East College
  "English":                                    "East College",
  "Creative Writing":                           "East College",
  "Classical Studies":                          "East College",
  "Religion":                                   "East College",
  "Philosophy":                                 "East College",
  "Judaic Studies":                             "East College",
  "Hebrew":                                     "East College",
  "Latin":                                      "East College",
  "Greek":                                      "East College",
  "Ethics":                                     "East College",

  // Modern Languages — Bosler Hall
  "French & Francophone Studies":               "Bosler Hall",
  "German":                                     "Bosler Hall",
  "Russian":                                    "Bosler Hall",
  "Spanish":                                    "Bosler Hall",
  "Spanish & Portuguese":                       "Bosler Hall",
  "Portuguese & Brazilian Studies":             "Bosler Hall",
  "Film & Media Studies":                       "Bosler Hall",

  // Social Sciences — Denny Hall
  "History":                                    "Denny Hall",
  "Political Science":                          "Denny Hall",
  "Anthropology":                               "Denny Hall",
  "Sociology":                                  "Denny Hall",
  "American Studies":                           "Denny Hall",
  "Arabic":                                     "Denny Hall",
  "Middle East Studies":                        "Denny Hall",
  "Law & Policy":                               "Denny Hall",
  "Law, Justice, and Society":                  "Denny Hall",

  // Social Sciences — Althouse Hall
  "Economics":                                  "Althouse Hall",
  "Quantitative Economics":                     "Althouse Hall",
  "Africana Studies":                           "Althouse Hall",

  // Social Sciences — Landis House
  "Women's, Gender & Sexuality Studies":        "Landis House",
  "Women's, Gender & Sexuality Studies (WGSS)": "Landis House",
  "WGSS":                                       "Landis House",
  "Sexuality Studies":                          "Landis House",

  // Sciences — Rector Science Complex
  "Biology":                                    "Rector Science Complex",
  "Chemistry":                                  "Rector Science Complex",
  "Psychology":                                 "Rector Science Complex",
  "Neuroscience":                               "Rector Science Complex",
  "Biochemistry & Molecular Biology":           "Rector Science Complex",

  // Sciences — Tome Hall
  "Computer Science":                           "Tome Hall",
  "Mathematics":                                "Tome Hall",
  "Physics":                                    "Tome Hall",
  "Astronomy":                                  "Tome Hall",
  "Physics & Astronomy":                        "Tome Hall",

  // Environmental / Earth — Kaufman Hall
  "Geosciences":                                "Kaufman Hall",
  "Earth Sciences":                             "Kaufman Hall",
  "Environmental Studies & Environmental Science": "Kaufman Hall",
  "Environmental Studies":                      "Kaufman Hall",
  "Environmental Science":                      "Kaufman Hall",
  "Health Studies":                             "Kaufman Hall",
  "Food Studies":                               "Kaufman Hall",

  // Global — Stern Center for Global Education
  "East Asian Studies":                         "Stern Center for Global Education",
  "Chinese":                                    "Stern Center for Global Education",
  "Japanese":                                   "Stern Center for Global Education",
  "International Business & Management":        "Stern Center for Global Education",
  "International Studies":                      "Stern Center for Global Education",
  "Security Studies":                           "Stern Center for Global Education",
  "Global Mosaics":                             "Stern Center for Global Education",
  "Business (International Business & Management)": "Stern Center for Global Education",

  // Fine & Performing Arts
  "Art & Art History":                          "Emil R. Weiss Center for the Arts",
  "Music":                                      "Emil R. Weiss Center for the Arts",
  "Theatre & Dance":                            "Montgomery Hall",
  "Theatre":                                    "Montgomery Hall",
  "Dance":                                      "Montgomery Hall",

  // Pre-Professional / Advising Tracks — Biddle House
  "Pre-Health":                                 "Biddle House",
  "Pre-Law":                                    "Biddle House",
  "Law (3-3), Pre-Law":                         "Biddle House",
  "Engineering (3-2) & Pre-Engineering":        "Biddle House",
  "Pre-Engineering":                            "Biddle House",

  // Standalone / Specialized
  "Archaeology":                                "Keck Archaeology Laboratory",
  "Educational Studies":                        "Educational Studies Department Building",
  "Military Science & ROTC":                    "ROTC Building",
  "ROTC":                                       "ROTC Building",
  "Writing Program":                            "Waidner-Spahr Library",
  "Data Analytics":                             "Waidner-Spahr Library",
  "First-Year Seminar":                         "Holland Union Building",


  "Italian Studies Program in Bologna": "Bosler Hall",
  "Bremen": "Stern Center for Global Education",
  "Italian": "Bosler Hall",
  "Bologna": "Stern Center for Global Education",
  "Piano": "Emil R. Weiss Center for the Arts",
  "Collaborative Piano": "Emil R. Weiss Center for the Arts",
  "Journalism": "East College"
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: FUZZY MATCHING ENGINE
// Strategy: normalize both strings (lowercase, replace non-alphanumeric with
// space), extract "significant tokens" (length ≥ 3, not in noise word set),
// then score by overlap count. Best score wins; minimum score ≥ 1 required.
// ─────────────────────────────────────────────────────────────────────────────

const BUILDING_NOISE = new Set([
  'the', 'for', 'and', 'of', 'at', 'in', 'a', 'an', 'to', 'by',
  'hall', 'building', 'center', 'house', 'complex', 'laboratory', 'lab',
  'library', 'science', 'sciences', 'arts', 'department', 'college',
  'union', 'global', 'education', 'studies', 'studio', 'studios',
]);

const DEPARTMENT_NOISE = new Set([
  'the', 'for', 'and', 'of', 'at', 'in', 'a', 'an', 'to', 'by',
  'science', 'sciences', 'studies', 'program', 'department',
]);

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTokens(str, noiseSet) {
  return normalize(str)
    .split(' ')
    .filter(w => w.length >= 3 && !noiseSet.has(w));
}

/**
 * Finds the best fuzzy match for `targetName` within the `candidates` array.
 * Each candidate is expected to have a `.name` property.
 * Returns the best-matching candidate or null if no overlap found.
 */
function fuzzyMatch(targetName, candidates, noiseSet) {
  const targetNorm = normalize(targetName);
  const targetTokens = getTokens(targetName, noiseSet);

  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateNorm = normalize(candidate.name);
    const candidateTokens = getTokens(candidate.name, noiseSet);

    // Count token hits in both directions to catch partial name variants
    const forwardHits = targetTokens.filter(t => candidateNorm.includes(t)).length;
    const reverseHits = candidateTokens.filter(t => targetNorm.includes(t)).length;
    const score = forwardHits + reverseHits;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestScore >= 1 ? bestMatch : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3: MAIN ORCHESTRATION
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function mapDepartmentsToBuildings() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  Dickinson College — Department → Building Migration Script');
  console.log('════════════════════════════════════════════════════════════════\n');

  // ── STEP 1: Fetch all departments and buildings from the database ──────────
  console.log('► Fetching all departments from the database...');
  const { data: dbDepartments, error: deptError } = await supabase
    .from('departments')
    .select('id, name');

  if (deptError) {
    console.error('FATAL: Could not fetch departments:', deptError.message);
    process.exit(1);
  }
  console.log(`  ✓ Found ${dbDepartments.length} department(s).\n`);

  console.log('► Fetching all buildings from the database...');
  const { data: dbBuildings, error: buildingError } = await supabase
    .from('buildings')
    .select('id, name');

  if (buildingError) {
    console.error('FATAL: Could not fetch buildings:', buildingError.message);
    process.exit(1);
  }
  console.log(`  ✓ Found ${dbBuildings.length} building(s).\n`);

  // ── STEP 2: Build a lookup: dictionary key → resolved target building name ──
  // We normalize all dictionary keys for robust lookup against DB dept names.
  const dictEntries = Object.entries(departmentMapping).map(([deptName, buildingName]) => ({
    deptName,
    buildingName,
    normalizedDeptName: normalize(deptName),
    deptTokens: getTokens(deptName, DEPARTMENT_NOISE),
  }));

  // ── STEP 3: Resolution loop ───────────────────────────────────────────────
  const successfulMatches   = [];
  const unmatchedDepartments = []; // DB dept has no mapping in the PDF dictionary
  const unmatchedBuildings   = []; // Mapping found, but building missing in DB

  console.log('► Running the Resolution Engine...\n');

  for (const dbDept of dbDepartments) {
    const dbDeptNorm = normalize(dbDept.name);
    const dbDeptTokens = getTokens(dbDept.name, DEPARTMENT_NOISE);

    // 3a. Find best-matching dictionary key for this DB department
    let bestDictEntry = null;
    let bestDictScore = 0;

    for (const entry of dictEntries) {
      const forwardHits = entry.deptTokens.filter(t => dbDeptNorm.includes(t)).length;
      const reverseHits = dbDeptTokens.filter(t => entry.normalizedDeptName.includes(t)).length;
      const score = forwardHits + reverseHits;

      if (score > bestDictScore) {
        bestDictScore = score;
        bestDictEntry = entry;
      }
    }

    if (!bestDictEntry || bestDictScore < 1) {
      unmatchedDepartments.push({ dbName: dbDept.name });
      continue;
    }

    const targetBuildingName = bestDictEntry.buildingName;

    // 3b. Fuzzy-match the target building name against real DB buildings
    const matchedBuilding = fuzzyMatch(targetBuildingName, dbBuildings, BUILDING_NOISE);

    if (!matchedBuilding) {
      unmatchedBuildings.push({
        dbDeptName: dbDept.name,
        dictKey: bestDictEntry.deptName,
        targetBuilding: targetBuildingName,
      });
      continue;
    }

    successfulMatches.push({
      dbDeptId:       dbDept.id,
      dbDeptName:     dbDept.name,
      dictKey:        bestDictEntry.deptName,
      targetBuilding: targetBuildingName,
      matchedBuilding: matchedBuilding.name,
      matchedBuildingId: matchedBuilding.id,
    });
  }

  // ── STEP 4: Execute updates ───────────────────────────────────────────────
  console.log(`► Executing ${successfulMatches.length} database update(s)...\n`);

  let updateSuccessCount = 0;
  const updateFailures = [];

  for (const match of successfulMatches) {
    const { error: updateError } = await supabase
      .from('departments')
      .update({ primary_building_id: match.matchedBuildingId })
      .eq('id', match.dbDeptId);

    if (updateError) {
      updateFailures.push({ ...match, error: updateError.message });
    } else {
      updateSuccessCount++;
      console.log(
        `  ✓ [${match.dbDeptName}]`
        + `\n      PDF key: "${match.dictKey}"`
        + `\n      Target:  "${match.targetBuilding}"`
        + `\n      Matched: "${match.matchedBuilding}" (id: ${match.matchedBuildingId})\n`
      );
    }
  }

  // ── STEP 5: Audit Summary ─────────────────────────────────────────────────
  const totalDepts = dbDepartments.length;
  const separator = '────────────────────────────────────────────────────────────────';

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  AUDIT SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  Total DB departments processed : ${totalDepts}`);
  console.log(`  ✅ Successfully updated         : ${updateSuccessCount}`);
  console.log(`  ❌ Update failures (DB errors)  : ${updateFailures.length}`);
  console.log(`  ⚠️  No mapping in PDF dictionary : ${unmatchedDepartments.length}`);
  console.log(`  ⚠️  Mapping found, building MIA  : ${unmatchedBuildings.length}`);
  console.log(separator);

  if (updateFailures.length > 0) {
    console.log('\n  [UPDATE FAILURES — database errors during write]');
    updateFailures.forEach(f => {
      console.log(`    • "${f.dbDeptName}" → "${f.matchedBuilding}" : ${f.error}`);
    });
  }

  if (unmatchedDepartments.length > 0) {
    console.log('\n  [UNMATCHED DEPARTMENTS — no entry found in PDF mapping dictionary]');
    console.log('  These departments exist in the DB but could not be resolved to a');
    console.log('  building. Check for spelling differences or new departments.');
    unmatchedDepartments.forEach(d => {
      console.log(`    • "${d.dbName}"`);
    });
  }

  if (unmatchedBuildings.length > 0) {
    console.log('\n  [UNMATCHED BUILDINGS — PDF mapping found, but building missing in DB]');
    console.log('  Run the seed:buildings script first, or add these buildings manually.');
    unmatchedBuildings.forEach(b => {
      console.log(`    • Dept: "${b.dbDeptName}"`);
      console.log(`      PDF key: "${b.dictKey}"`);
      console.log(`      Expected building: "${b.targetBuilding}"`);
    });
  }

  console.log('\n════════════════════════════════════════════════════════════════\n');

  const hasFailures =
    updateFailures.length > 0 ||
    unmatchedDepartments.length > 0 ||
    unmatchedBuildings.length > 0;

  process.exit(hasFailures ? 1 : 0);
}

mapDepartmentsToBuildings();
