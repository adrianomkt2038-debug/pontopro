-- Clock records must be created/updated through the validated backend functions.
-- Direct self-service table writes would bypass sequence and server-side checks.
DROP POLICY IF EXISTS "Users can insert own registros" ON public.registros_ponto;
DROP POLICY IF EXISTS "Users can update own registros" ON public.registros_ponto;

-- Employees may submit pending requests, but cannot self-approve them by crafting REST payloads.
ALTER POLICY "Users can create own justificativas"
  ON public.justificativas
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pendente'
    AND aprovado_por IS NULL
  );

ALTER POLICY "Users can create own ocorrencias"
  ON public.ocorrencias
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pendente'
    AND aprovado_por IS NULL
  );
