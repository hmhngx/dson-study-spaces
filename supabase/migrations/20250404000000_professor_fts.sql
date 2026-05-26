-- =============================================================================
-- Migration: Professor Full-Text Search Engine
-- Purpose: Add tsvector column, auto-update trigger, GIN index, and ranked
--          search RPC function to replace ilike-based name-only search.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Add search_vector column
-- -----------------------------------------------------------------------------

ALTER TABLE professors ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- -----------------------------------------------------------------------------
-- 2. Trigger function — rebuilds search_vector on INSERT or UPDATE
--
--    Weights:
--      A → name, title          (highest relevance)
--      B → department name      (medium relevance)
--      C → bio, publications    (body text)
--
--    publications is a JSONB array of strings; jsonb_array_elements_text()
--    unnests it and string_agg() collapses it to a single text value for
--    to_tsvector().
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION professors_search_vector_update()
RETURNS TRIGGER AS $$
DECLARE
  dept_name TEXT;
  pub_text  TEXT;
BEGIN
  SELECT name INTO dept_name
  FROM departments
  WHERE id = NEW.department_id;

  SELECT string_agg(value, ' ') INTO pub_text
  FROM jsonb_array_elements_text(COALESCE(NEW.publications, '[]'::jsonb));

  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name,  '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(dept_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.bio,   '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(pub_text,  '')), 'C');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 3. Attach trigger to professors table
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS professors_search_vector_trigger ON professors;

CREATE TRIGGER professors_search_vector_trigger
  BEFORE INSERT OR UPDATE ON professors
  FOR EACH ROW EXECUTE FUNCTION professors_search_vector_update();

-- -----------------------------------------------------------------------------
-- 4. Backfill search_vector for all existing rows
--    Computed inline with a lateral subquery — mirrors the trigger function
--    exactly without relying on any specific non-key column existing.
-- -----------------------------------------------------------------------------

UPDATE professors
SET search_vector =
  setweight(to_tsvector('english', COALESCE(professors.name,  '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(professors.title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(src.dept_name,    '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(professors.bio,   '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(src.pub_text,     '')), 'C')
FROM (
  SELECT
    p.id,
    d.name AS dept_name,
    (SELECT string_agg(val, ' ')
     FROM jsonb_array_elements_text(COALESCE(p.publications, '[]'::jsonb)) AS val
    ) AS pub_text
  FROM professors p
  LEFT JOIN departments d ON d.id = p.department_id
) AS src
WHERE professors.id = src.id;

-- -----------------------------------------------------------------------------
-- 5. GIN index for millisecond @@ query times
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_prof_search ON professors USING GIN(search_vector);

-- -----------------------------------------------------------------------------
-- 6. RPC function: search_professors_fts
--
--    Supabase JS .order() cannot reference computed expressions such as
--    ts_rank(...), so the ranked query lives here and is called via
--    supabase.rpc('search_professors_fts', { ... }).
--
--    Returns all professor columns plus:
--      departments             → { name } object to match the JS query-builder
--                                response shape (no frontend changes required)
--      professor_office_hours  → active hours only (valid_until IS NULL),
--                                aggregated as JSONB to avoid a second
--                                round-trip from the API
--      rank                    → ts_rank score for client-side display if needed
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION search_professors_fts(
  query   text,
  dept_id uuid    DEFAULT NULL,
  bldg_id uuid    DEFAULT NULL,
  lim     integer DEFAULT 20,
  off     integer DEFAULT 0
)
RETURNS TABLE (
  id                     uuid,
  name                   text,
  email                  text,
  title                  varchar(255),
  bio                    text,
  publications           jsonb,
  department_id          uuid,
  building_id            uuid,
  is_active              boolean,
  first_seen_at          timestamptz,
  departments            jsonb,
  professor_office_hours jsonb,
  rank                   real
)
LANGUAGE sql STABLE AS $$
  SELECT
    p.id,
    p.name,
    p.email,
    p.title,
    p.bio,
    p.publications,
    p.department_id,
    p.building_id,
    p.is_active,
    p.first_seen_at,
    jsonb_build_object('name', d.name)                              AS departments,
    COALESCE(
      (SELECT jsonb_agg(oh)
       FROM professor_office_hours oh
       WHERE oh.professor_id = p.id AND oh.valid_until IS NULL),
      '[]'::jsonb
    )                                                               AS professor_office_hours,
    ts_rank(
      p.search_vector,
      websearch_to_tsquery('english', query)
    )                                                               AS rank
  FROM professors p
  LEFT JOIN departments d ON d.id = p.department_id
  WHERE p.search_vector @@ websearch_to_tsquery('english', query)
    AND (dept_id IS NULL OR p.department_id = dept_id)
    AND (bldg_id IS NULL OR p.building_id = bldg_id)
  ORDER BY rank DESC
  LIMIT lim OFFSET off;
$$;

COMMIT;
