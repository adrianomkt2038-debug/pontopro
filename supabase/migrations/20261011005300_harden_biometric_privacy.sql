-- Harden biometric data access and remove unsafe first-user admin assignment.
-- Facial descriptors must never be exposed to anonymous clients.
DROP POLICY IF EXISTS "Anon can read all face_descriptors" ON public.face_descriptors;

-- Keep facial photos private; the app calculates descriptors in-browser and does not
-- need to persist or publicly serve raw face images.
UPDATE storage.buckets SET public = false WHERE id = 'face-photos';

DROP POLICY IF EXISTS "Authenticated users can upload face photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update face photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can read face photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own face photos" ON storage.objects;

CREATE POLICY "Admins manage private face photos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'face-photos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'face-photos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Never elevate whoever happens to be the first public signup to administrator.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'colaborador');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Start with public self-registration disabled. An administrator can enable it
-- later from Configurações after the initial admin has been verified.
UPDATE public.configuracoes_sistema
SET valor = 'false', updated_at = now()
WHERE chave = 'permitir_auto_cadastro';
