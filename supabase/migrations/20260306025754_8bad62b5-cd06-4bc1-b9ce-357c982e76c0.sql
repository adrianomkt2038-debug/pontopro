
-- Tabela de tipos de registro (batidas configuráveis)
CREATE TABLE public.tipos_registro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  batidas text[] NOT NULL DEFAULT '{entrada,almoco_saida,almoco_retorno,saida}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER update_tipos_registro_updated_at
  BEFORE UPDATE ON public.tipos_registro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.tipos_registro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tipos_registro"
  ON public.tipos_registro FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view tipos_registro"
  ON public.tipos_registro FOR SELECT
  TO authenticated
  USING (true);

-- Vincular à escala
ALTER TABLE public.escalas ADD COLUMN tipo_registro_id uuid REFERENCES public.tipos_registro(id);

-- Inserir tipo padrão
INSERT INTO public.tipos_registro (nome, descricao, batidas)
VALUES 
  ('Padrão (4 batidas)', 'Entrada, Almoço Saída, Almoço Retorno, Saída', '{entrada,almoco_saida,almoco_retorno,saida}'),
  ('Meio Período', 'Apenas Entrada e Saída', '{entrada,saida}');
