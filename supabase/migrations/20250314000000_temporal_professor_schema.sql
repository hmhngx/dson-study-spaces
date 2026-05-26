-- =============================================================================
-- Migration: Temporal Professor Schema for Dickinson College Faculty Pipeline
-- Purpose: Redesign professors table for temporal data model + NLP extraction
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ALTER professors table
-- -----------------------------------------------------------------------------

-- Add title for faculty rank/position (VARCHAR 255)
ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Add bio for unstructured NLP-extracted faculty bio text
ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add publications as JSONB array (NLP extraction / structured data)
ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS publications JSONB DEFAULT '[]';

-- Add is_active for soft-delete / pipeline filtering
ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add first_seen_at for temporal pipeline tracking
ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Drop legacy office_hours column (moved to professor_office_hours)
ALTER TABLE professors
  DROP COLUMN IF EXISTS office_hours;

-- -----------------------------------------------------------------------------
-- 2. CREATE professor_office_hours temporal tracking table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS professor_office_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id UUID NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  term_identifier VARCHAR(50) NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME,
  end_time TIME,
  is_by_appointment BOOLEAN DEFAULT FALSE,
  location VARCHAR(255),
  valid_from TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -----------------------------------------------------------------------------
-- 3. CREATE index for fast temporal lookups
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_temporal_hours
  ON professor_office_hours (professor_id, valid_from, valid_until);

COMMIT;
