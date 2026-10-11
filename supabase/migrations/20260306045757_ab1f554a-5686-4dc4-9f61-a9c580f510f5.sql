
CREATE TABLE public.audit_configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chave TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit_configuracoes"
  ON public.audit_configuracoes
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
