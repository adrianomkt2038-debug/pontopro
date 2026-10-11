
-- Table to store tolerance settings
CREATE TABLE public.configuracoes_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor integer NOT NULL DEFAULT 0,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage configuracoes_ponto" ON public.configuracoes_ponto
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view configuracoes_ponto" ON public.configuracoes_ponto
  FOR SELECT TO authenticated
  USING (true);

-- Insert default tolerance values (in minutes)
INSERT INTO public.configuracoes_ponto (chave, valor, descricao) VALUES
  ('tolerancia_banco_horas', 10, 'Tolerância em minutos para considerar horas extras no banco de horas'),
  ('tolerancia_jornada_incompleta', 10, 'Tolerância em minutos para considerar jornada incompleta');

-- Table for banco de horas records
CREATE TABLE public.banco_horas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registro_ponto_id uuid REFERENCES public.registros_ponto(id),
  data date NOT NULL,
  minutos_trabalhados integer NOT NULL DEFAULT 0,
  minutos_esperados integer NOT NULL DEFAULT 0,
  saldo_minutos integer NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.banco_horas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage banco_horas" ON public.banco_horas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own banco_horas" ON public.banco_horas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_configuracoes_ponto_updated_at
  BEFORE UPDATE ON public.configuracoes_ponto
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_banco_horas_updated_at
  BEFORE UPDATE ON public.banco_horas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
