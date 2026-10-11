-- Keep trigger-only SECURITY DEFINER functions out of the public RPC surface.
REVOKE EXECUTE ON FUNCTION public.calcular_banco_horas_automatico() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_nsr_and_hash() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_registro_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_registro_immutable() FROM PUBLIC, anon, authenticated;

-- has_role is required by authenticated RLS policies. Limit it to the caller's own identity.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
     AND EXISTS (
       SELECT 1
       FROM public.user_roles
       WHERE user_id = _user_id AND role = _role
     );
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
