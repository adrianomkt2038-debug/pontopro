
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  assigned_role app_role;
BEGIN
  -- Check if this is the first user
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'colaborador';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
