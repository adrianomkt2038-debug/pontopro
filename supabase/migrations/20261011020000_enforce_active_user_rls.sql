-- Deny authenticated Data API access to accounts whose profile is inactive.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.active IS TRUE
  );
$function$;

REVOKE ALL ON FUNCTION private.is_active_user() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_user() TO authenticated;

DO $migration$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'user_roles', 'cargos', 'escalas', 'funcionarios', 'registros_ponto',
    'justificativas', 'ocorrencias', 'face_descriptors', 'tipos_registro',
    'configuracoes_ponto', 'banco_horas', 'configuracoes_sistema',
    'audit_configuracoes', 'sessoes_ponto', 'audit_entidades'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS active_user_guard ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY active_user_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.is_active_user()) WITH CHECK (private.is_active_user())',
      table_name
    );
  END LOOP;
END;
$migration$;

-- Profile creation must remain possible for the auth.users INSERT trigger.
-- Restrict profile reads and updates for inactive sessions instead.
DROP POLICY IF EXISTS active_user_select_guard ON public.profiles;
CREATE POLICY active_user_select_guard
  ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.is_active_user());

DROP POLICY IF EXISTS active_user_update_guard ON public.profiles;
CREATE POLICY active_user_update_guard
  ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (private.is_active_user())
  WITH CHECK (private.is_active_user());
