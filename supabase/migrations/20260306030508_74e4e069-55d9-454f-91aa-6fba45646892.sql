
CREATE OR REPLACE FUNCTION public.generate_nsr_and_hash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  hash_input text;
BEGIN
  IF NEW.nsr IS NULL THEN
    NEW.nsr := nextval('public.nsr_seq');
  END IF;
  
  NEW.horario_servidor := now();
  
  hash_input := NEW.nsr::text || '|' || NEW.user_id::text || '|' || NEW.data::text || '|' || COALESCE(NEW.entrada::text, '') || '|' || NEW.horario_servidor::text;
  NEW.hash_registro := encode(extensions.digest(hash_input::bytea, 'sha256'), 'hex');
  
  RETURN NEW;
END;
$function$;
