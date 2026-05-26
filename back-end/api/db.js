/**
 * Supabase client for the Express API.
 *
 * CONNECTION POLICY
 * -----------------
 * - This API MUST use getSupabase() (HTTP via @supabase/supabase-js). It does not
 *   open Postgres sockets and is safe for serverless / high concurrency.
 * - Any direct Postgres access (pg, Prisma, raw SQL from this process) MUST use
 *   Supabase's transaction connection pooler: port 6543 with ?pgbouncer=true.
 *   Do NOT use session mode on port 5432 from the API — that exhausts connections.
 *
 * Set DATABASE_URL only when adding direct SQL; it is validated on first init.
 */

const { createClient } = require('@supabase/supabase-js');

let supabase = null;

/**
 * @param {string | undefined} url - postgres:// connection string
 * @throws {Error} when URL uses session port or pooler without pgbouncer=true
 */
function validatePoolerDatabaseUrl(url) {
  if (!url || String(url).trim() === '') return;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL. See back-end/api/db.js.');
  }

  const port = parsed.port || '5432';
  const pgbouncer = parsed.searchParams.get('pgbouncer');

  if (port === '5432' || (port === '6543' && pgbouncer !== 'true')) {
    throw new Error(
      'DATABASE_URL must use the Supabase transaction pooler (port 6543, ?pgbouncer=true). ' +
        'Session/direct port 5432 must not be used from the API. See back-end/api/db.js.'
    );
  }
}

function getSupabase() {
  if (!supabase) {
    const dbUrl =
      process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    validatePoolerDatabaseUrl(dbUrl);

    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    supabase = createClient(url, serviceRoleKey);
  }
  return supabase;
}

module.exports = { getSupabase, validatePoolerDatabaseUrl };
