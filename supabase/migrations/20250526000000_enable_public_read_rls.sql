BEGIN;

-- 1) Enable RLS on all public data tables
ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_office_hours ENABLE ROW LEVEL SECURITY;

-- 2) Remove old policies if re-running (idempotent)
DROP POLICY IF EXISTS professors_read_public ON public.professors;
DROP POLICY IF EXISTS departments_read_public ON public.departments;
DROP POLICY IF EXISTS buildings_read_public ON public.buildings;
DROP POLICY IF EXISTS professor_office_hours_read_public ON public.professor_office_hours;

-- 3) Public READ policies (anon + authenticated)
CREATE POLICY professors_read_public
ON public.professors
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY departments_read_public
ON public.departments
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY buildings_read_public
ON public.buildings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY professor_office_hours_read_public
ON public.professor_office_hours
FOR SELECT
TO anon, authenticated
USING (true);

-- 4) No public WRITE policies are created.
--    This intentionally denies INSERT/UPDATE/DELETE for anon/authenticated.
--    service_role bypasses RLS by design; postgres is superuser/admin.

COMMIT;
