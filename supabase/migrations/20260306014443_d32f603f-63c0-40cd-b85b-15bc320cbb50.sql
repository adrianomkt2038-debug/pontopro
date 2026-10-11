
-- Tabela para armazenar descritores faciais dos usuários
CREATE TABLE public.face_descriptors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  descriptor float8[] NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice para busca por user_id
CREATE INDEX idx_face_descriptors_user_id ON public.face_descriptors(user_id);

-- Unique constraint: um descriptor por usuário
ALTER TABLE public.face_descriptors ADD CONSTRAINT face_descriptors_user_id_unique UNIQUE (user_id);

-- Enable RLS
ALTER TABLE public.face_descriptors ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage face_descriptors"
  ON public.face_descriptors FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own face_descriptor"
  ON public.face_descriptors FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anon can read all face_descriptors"
  ON public.face_descriptors FOR SELECT
  TO anon
  USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_face_descriptors_updated_at
  BEFORE UPDATE ON public.face_descriptors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket para fotos faciais
INSERT INTO storage.buckets (id, name, public) VALUES ('face-photos', 'face-photos', true)
ON CONFLICT (id) DO NOTHING;
