
CREATE TABLE public.sessoes_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  registro_ponto_id uuid REFERENCES public.registros_ponto(id) ON DELETE SET NULL,
  acao text NOT NULL,
  ip_address text,
  city text,
  country_code text,
  latitude double precision,
  longitude double precision,
  user_agent text,
  sistema_operacional text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sessoes_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sessoes_ponto" ON public.sessoes_ponto
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own sessoes_ponto" ON public.sessoes_ponto
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
