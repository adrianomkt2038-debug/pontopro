
CREATE POLICY "Anon can read configuracoes_sistema"
  ON public.configuracoes_sistema
  FOR SELECT
  TO anon
  USING (true);
