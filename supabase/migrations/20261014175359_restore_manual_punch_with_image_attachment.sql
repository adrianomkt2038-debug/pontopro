ALTER TABLE public.sessoes_ponto
  ADD COLUMN IF NOT EXISTS comprovante_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ponto-comprovantes',
  'ponto-comprovantes',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

DROP POLICY IF EXISTS "ponto_comprovantes_insert_own_or_admin" ON storage.objects;
CREATE POLICY "ponto_comprovantes_insert_own_or_admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ponto-comprovantes'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
);

DROP POLICY IF EXISTS "ponto_comprovantes_select_own_or_admin" ON storage.objects;
CREATE POLICY "ponto_comprovantes_select_own_or_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ponto-comprovantes'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
);