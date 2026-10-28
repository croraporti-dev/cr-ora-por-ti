-- Supabase publica las tablas del esquema "public" por su API REST (PostgREST) usando la clave "anon",
-- que es pública. La app no usa esa API: se conecta directo a Postgres con el dueño de las tablas,
-- que no queda afectado por RLS. Activar RLS sin políticas bloquea todo acceso por la API pública.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
