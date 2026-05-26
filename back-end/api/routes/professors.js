const express = require('express');
const { getSupabase } = require('../db');
const { extractFacId } = require('../utils/facId');
const { resolveCanonicalBuildingName } = require('../utils/buildingAliases');
const { buildingSlug, isUuid } = require('../utils/buildingSlug');

const router = express.Router();

const SYNC_CHUNK_SIZE = 50;
const MAX_SYNC_RECORDS = Number(process.env.MAX_SYNC_RECORDS) || 1000;
const INGESTION_ONLY_FIELDS = ['department', 'building', 'office_hours', 'office_room'];

const SYNC_PROFILE_FIELDS = [
  'name',
  'title',
  'bio',
  'publications',
  'email',
  'profile_url',
  'fac_id',
];
const SYNC_INGESTION_FIELDS = ['department', 'building'];
const SYNC_BLOCKED_RELATIONAL = ['id', 'department_id', 'building_id'];
const SYNC_ALLOWED_FIELDS = [...SYNC_PROFILE_FIELDS, ...SYNC_INGESTION_FIELDS];

const UPSERT_DB_COLUMNS = new Set([
  ...SYNC_PROFILE_FIELDS,
  'department_id',
  'building_id',
]);

function isValidEmail(email) {
  return email != null && String(email).trim().includes('@');
}

function resolveIdentityFields(raw) {
  const email = isValidEmail(raw.email) ? String(raw.email).trim() : null;
  let profile_url =
    raw.profile_url != null && String(raw.profile_url).trim() !== ''
      ? String(raw.profile_url).trim()
      : null;
  let fac_id =
    raw.fac_id != null && String(raw.fac_id).trim() !== ''
      ? String(raw.fac_id).trim()
      : null;
  if (profile_url && !fac_id) {
    fac_id = extractFacId(profile_url);
  }
  if (!email && !profile_url && !fac_id) {
    return null;
  }
  return { email, profile_url, fac_id };
}

function pickSyncProfessorRow(prof, logger, index) {
  if (prof == null || typeof prof !== 'object') {
    return {};
  }
  const row = {};
  for (const field of SYNC_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(prof, field) && prof[field] !== undefined) {
      row[field] = prof[field];
    }
  }
  for (const field of SYNC_BLOCKED_RELATIONAL) {
    if (Object.prototype.hasOwnProperty.call(prof, field) && prof[field] != null) {
      logger.warn(
        'Professors sync: ignored blocked relational field %s at index %d',
        field,
        index
      );
    }
  }
  return row;
}

function stripIngestionFields(row) {
  const clean = { ...row };
  for (const field of INGESTION_ONLY_FIELDS) {
    delete clean[field];
  }
  return clean;
}

function pickUpsertDbColumns(row) {
  const clean = {};
  for (const [key, value] of Object.entries(row)) {
    if (UPSERT_DB_COLUMNS.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

async function upsertProfessorByIdentity(supabase, row) {
  const clean = pickUpsertDbColumns(stripIngestionFields(row));
  if (clean.email) {
    return supabase.from('professors').upsert(clean, { onConflict: 'email' }).select('id').single();
  }
  if (clean.profile_url) {
    return supabase
      .from('professors')
      .upsert(clean, { onConflict: 'profile_url' })
      .select('id')
      .single();
  }
  if (clean.fac_id) {
    return supabase.from('professors').upsert(clean, { onConflict: 'fac_id' }).select('id').single();
  }
  return { data: null, error: { message: 'missing_identity_key' } };
}

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const CAMPUS_TIMEZONE = 'America/New_York';

function getCampusDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPUS_TIMEZONE,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    dayName: parts.weekday,
    timeString: `${parts.hour}:${parts.minute}`,
  };
}

function parseTimeToMinutes(timeStr) {
  if (timeStr == null || timeStr === '') return null;
  const [hourPart, minutePart] = String(timeStr).split(':').map(Number);
  if (Number.isNaN(hourPart)) return null;
  return hourPart * 60 + (Number.isNaN(minutePart) ? 0 : minutePart);
}

function isOfficeHourActiveNow(oh, dayIndex, currentMinutes) {
  if (oh.day_of_week !== dayIndex) return false;
  const startMinutes = parseTimeToMinutes(oh.start_time);
  const endMinutes = parseTimeToMinutes(oh.end_time);
  if (startMinutes == null || endMinutes == null) return false;
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function mapOfficeHour(oh) {
  const day =
    oh.day_of_week != null && oh.day_of_week >= 0 && oh.day_of_week <= 6
      ? DAY_NAMES[oh.day_of_week]
      : null;
  return { ...oh, day };
}

function mapProfessorOfficeHours(prof) {
  const active = (prof.professor_office_hours ?? []).filter(
    (oh) => oh.valid_until === null
  );
  return {
    ...prof,
    professor_office_hours: active.map(mapOfficeHour),
  };
}

async function resolveBuildingUuid(supabase, buildingIdParam) {
  const raw = String(buildingIdParam).trim();
  if (!raw) return null;
  if (isUuid(raw)) return raw;

  const { data: rows, error } = await supabase.from('buildings').select('id, name');
  if (error) {
    throw new Error(`Building lookup failed: ${error.message}`);
  }
  for (const row of rows ?? []) {
    if (buildingSlug(row.name) === raw) return row.id;
  }
  return null;
}

function createProfessorsRouter(logger) {
  // GET /departments — list all departments ordered by name
  router.get('/departments', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('departments').select('*').order('name');

      if (error) {
        logger.error('Departments GET error:', error.message);
        return res.status(500).json({ data: null, error: 'Failed to fetch departments.' });
      }

      res.set('Cache-Control', 'public, max-age=300');
      res.json({ data: data ?? [], error: null });
    } catch (err) {
      logger.error('Departments GET exception:', err.message);
      res.status(500).json({ data: null, error: 'Failed to fetch departments.' });
    }
  });

  // GET /active-now — minimal building IDs with faculty in office right now (campus ET)
  router.get('/active-now', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { dayName, timeString } = getCampusDateParts();
      const dayIndex = DAY_NAMES.indexOf(dayName);
      if (dayIndex < 0) {
        return res.status(500).json({ data: null, error: 'Failed to resolve campus day.' });
      }

      const [hourPart, minutePart] = timeString.split(':').map(Number);
      const currentMinutes = hourPart * 60 + minutePart;

      const { data: rows, error } = await supabase
        .from('professor_office_hours')
        .select('day_of_week, start_time, end_time, professors!inner(building_id)')
        .is('valid_until', null)
        .not('professors.building_id', 'is', null);

      if (error) {
        logger.error('Professors active-now error:', error.message);
        return res.status(500).json({ data: null, error: 'Failed to fetch active buildings.' });
      }

      const buildingIds = new Set();
      for (const row of rows ?? []) {
        if (!isOfficeHourActiveNow(row, dayIndex, currentMinutes)) continue;
        const buildingId = row.professors?.building_id;
        if (buildingId != null && buildingId !== '') {
          buildingIds.add(String(buildingId));
        }
      }

      res.set('Cache-Control', 'public, max-age=60');
      res.json({ data: [...buildingIds], error: null });
    } catch (err) {
      logger.error('Professors active-now exception:', err.message);
      res.status(500).json({ data: null, error: 'Failed to fetch active buildings.' });
    }
  });

  // GET / — search professors with optional name search, department filter, pagination
  router.get('/', async (req, res) => {
    try {
      const { q, department_id, building_id, limit: limitParam, offset: offsetParam } = req.query;
      const fetchAll =
        req.query.live_sync === 'true' || req.query.all === 'true';
      const limit = fetchAll
        ? 10000
        : Math.min(Math.max(Number(limitParam) || 20, 1), 100);
      const offset = Math.max(Number(offsetParam) || 0, 0);

      const supabase = getSupabase();

      let resolvedBuildingId = null;
      if (building_id != null && String(building_id).trim() !== '') {
        resolvedBuildingId = await resolveBuildingUuid(supabase, building_id);
        if (!resolvedBuildingId) {
          res.set('Cache-Control', 'public, max-age=60');
          return res.json({ data: [], error: null });
        }
      }

      if (q != null && String(q).trim() !== '') {
        // FTS path — uses websearch_to_tsquery + ts_rank ordering via RPC.
        // The RPC handles department/building filters, pagination, and
        // active-hours filtering (valid_until IS NULL) in a single query.
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'search_professors_fts',
          {
            query:   String(q).trim(),
            dept_id: department_id ? String(department_id).trim() : null,
            bldg_id: resolvedBuildingId,
            lim:     limit,
            off:     offset,
          }
        );

        if (rpcError) {
          logger.error('Professors FTS error:', rpcError.message);
          return res.status(500).json({ data: null, error: 'Failed to fetch professors.' });
        }

        const data = (rpcData ?? []).map(mapProfessorOfficeHours);
        res.set('Cache-Control', 'public, max-age=60');
        return res.json({ data, error: null });
      }

      // Non-search path — query builder with optional filters and pagination.
      let query = supabase
        .from('professors')
        .select('*, departments(name), professor_office_hours(*)');

      if (department_id != null && String(department_id).trim() !== '') {
        query = query.eq('department_id', String(department_id).trim());
      }
      if (resolvedBuildingId) {
        query = query.eq('building_id', resolvedBuildingId);
      }

      if (!fetchAll) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data: rawData, error } = await query;

      if (error) {
        logger.error('Professors GET error:', error.message);
        return res.status(500).json({ data: null, error: 'Failed to fetch professors.' });
      }

      const data = (rawData ?? []).map(mapProfessorOfficeHours);

      res.set('Cache-Control', 'public, max-age=60');
      res.json({ data, error: null });
    } catch (err) {
      logger.error('Professors GET exception:', err.message);
      res.status(500).json({ data: null, error: 'Failed to fetch professors.' });
    }
  });

  // POST /sync — internal webhook; chunked upsert by email / profile_url / fac_id
  router.post('/sync', async (req, res) => {
    const authHeader = req.headers.authorization;
    const secret = process.env.INTERNAL_CRON_SECRET;
    const valid =
      secret &&
      (authHeader === secret || authHeader === `Bearer ${secret}`);

    if (!valid) {
      logger.warn('Professors sync unauthorized attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Body must be an array of professor objects.' });
    }

    if (req.body.length > MAX_SYNC_RECORDS) {
      return res.status(413).json({
        error: `Payload exceeds maximum of ${MAX_SYNC_RECORDS} records.`,
      });
    }

    try {
      const supabase = getSupabase();
      const departmentIdByName = new Map();
      const buildingIdByName = new Map();
      let upserted = 0;
      const skipped = [];
      const errors = [];

      async function resolveDepartmentAndBuilding(row, index) {
        delete row.id;
        delete row.department_id;
        delete row.building_id;

        if (row.department != null && String(row.department).trim() !== '') {
          const name = String(row.department).trim();
          let deptId = departmentIdByName.get(name);
          if (deptId === undefined) {
            const { data: deptData, error: deptError } = await supabase
              .from('departments')
              .upsert({ name }, { onConflict: 'name' })
              .select('id')
              .single();
            if (deptError) {
              throw new Error(`Department upsert failed at index ${index}: ${deptError.message}`);
            }
            deptId = deptData?.id ?? null;
            departmentIdByName.set(name, deptId);
          }
          row.department_id = deptId;
        }

        if (row.building != null && String(row.building).trim() !== '') {
          const rawBuilding = String(row.building).trim();
          const canonicalName = resolveCanonicalBuildingName(rawBuilding);
          if (!canonicalName) {
            logger.warn(
              'Professors sync: no canonical building for %r at index %d',
              rawBuilding,
              index
            );
            return;
          }
          let buildingId = buildingIdByName.get(canonicalName);
          if (buildingId === undefined) {
            const { data: buildingRows, error: buildingError } = await supabase
              .from('buildings')
              .select('id')
              .eq('name', canonicalName)
              .limit(1);
            if (buildingError) {
              throw new Error(`Building lookup failed at index ${index}: ${buildingError.message}`);
            }
            buildingId = buildingRows?.[0]?.id ?? null;
            if (!buildingId) {
              logger.warn(
                'Professors sync: canonical building %r not in DB at index %d',
                canonicalName,
                index
              );
            }
            buildingIdByName.set(canonicalName, buildingId);
          }
          if (buildingId) {
            row.building_id = buildingId;
          }
        }
      }

      for (let chunkStart = 0; chunkStart < req.body.length; chunkStart += SYNC_CHUNK_SIZE) {
        const chunk = req.body.slice(chunkStart, chunkStart + SYNC_CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map(async (prof, offsetInChunk) => {
            const index = chunkStart + offsetInChunk;
            try {
              if (prof?.office_hours != null) {
                logger.warn('Professors sync: legacy office_hours ignored at index %d', index);
              }

              const row = pickSyncProfessorRow(prof, logger, index);
              await resolveDepartmentAndBuilding(row, index);

              const identity = resolveIdentityFields(row);
              if (!identity) {
                return { status: 'skipped', index, reason: 'missing_identity_key' };
              }

              if (identity.email) row.email = identity.email;
              if (identity.profile_url) row.profile_url = identity.profile_url;
              if (identity.fac_id) row.fac_id = identity.fac_id;

              const { data, error } = await upsertProfessorByIdentity(supabase, row);
              if (error) {
                return { status: 'error', index, reason: error.message };
              }
              if (data?.id) {
                return { status: 'upserted' };
              }
              return { status: 'error', index, reason: 'upsert returned no id' };
            } catch (rowErr) {
              return { status: 'error', index, reason: rowErr.message };
            }
          })
        );

        for (const result of chunkResults) {
          if (!result) continue;
          if (result.status === 'upserted') upserted += 1;
          else if (result.status === 'skipped') {
            skipped.push({ index: result.index, reason: result.reason });
          } else if (result.status === 'error') {
            errors.push({ index: result.index, reason: result.reason });
          }
        }
      }

      const statusCode = errors.length > 0 && upserted === 0 ? 500 : 200;
      res.status(statusCode).json({
        success: errors.length === 0,
        upserted,
        skipped,
        errors,
      });
    } catch (err) {
      logger.error('Professors sync exception', {
        message: err.message,
        stack: err.stack,
      });
      res.status(500).json({ error: 'Sync failed.', details: err.message });
    }
  });

  return router;
}

module.exports = createProfessorsRouter;
