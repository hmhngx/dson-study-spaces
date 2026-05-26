-- Professor identity keys for strict upsert (email, profile_url, fac_id).
-- Replaces unsafe name-only matching in ingestion pipelines.

BEGIN;

ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS profile_url TEXT,
  ADD COLUMN IF NOT EXISTS fac_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS professors_profile_url_unique
  ON professors (profile_url)
  WHERE profile_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS professors_fac_id_unique
  ON professors (fac_id)
  WHERE fac_id IS NOT NULL;

COMMIT;
