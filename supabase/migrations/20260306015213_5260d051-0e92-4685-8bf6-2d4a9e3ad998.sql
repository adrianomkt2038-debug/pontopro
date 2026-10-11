
-- Sequence para NSR (Número Sequencial de Registro) - imutável e sem gaps
CREATE SEQUENCE public.nsr_seq START 1 INCREMENT 1 NO CYCLE;

-- Adicionar colunas de integridade na tabela registros_ponto
ALTER TABLE public.registros_ponto 
  ADD COLUMN IF NOT EXISTS nsr bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS hash_registro text,
  ADD COLUMN IF NOT EXISTS terminal_id text,
  ADD COLUMN IF NOT EXISTS horario_servidor timestamp with time zone;

-- Impedir UPDATE nos campos imutáveis após criação
CREATE OR REPLACE FUNCTION public.protect_registro_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Bloquear alteração de campos imutáveis
  IF OLD.nsr IS NOT NULL AND NEW.nsr != OLD.nsr THEN
    RAISE EXCEPTION 'NSR não pode ser alterado';
  END IF;
  IF OLD.hash_registro IS NOT NULL AND NEW.hash_registro != OLD.hash_registro THEN
    RAISE EXCEPTION 'Hash do registro não pode ser alterado';
  END IF;
  IF OLD.entrada IS NOT NULL AND NEW.entrada IS DISTINCT FROM OLD.entrada THEN
    RAISE EXCEPTION 'Horário de entrada não pode ser alterado após registro';
  END IF;
  IF OLD.almoco_saida IS NOT NULL AND NEW.almoco_saida IS DISTINCT FROM OLD.almoco_saida THEN
    RAISE EXCEPTION 'Horário de saída para almoço não pode ser alterado após registro';
  END IF;
  IF OLD.almoco_retorno IS NOT NULL AND NEW.almoco_retorno IS DISTINCT FROM OLD.almoco_retorno THEN
    RAISE EXCEPTION 'Horário de retorno do almoço não pode ser alterado após registro';
  END IF;
  IF OLD.saida IS NOT NULL AND NEW.saida IS DISTINCT FROM OLD.saida THEN
    RAISE EXCEPTION 'Horário de saída não pode ser alterado após registro';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_protect_registro_immutable
  BEFORE UPDATE ON public.registros_ponto
  FOR EACH ROW EXECUTE FUNCTION public.protect_registro_immutable();

-- Impedir DELETE de registros de ponto
CREATE OR REPLACE FUNCTION public.prevent_registro_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Registros de ponto não podem ser excluídos';
END;
$$;

CREATE TRIGGER trigger_prevent_registro_delete
  BEFORE DELETE ON public.registros_ponto
  FOR EACH ROW EXECUTE FUNCTION public.prevent_registro_delete();

-- Função para gerar NSR e hash automaticamente no INSERT
CREATE OR REPLACE FUNCTION public.generate_nsr_and_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  hash_input text;
BEGIN
  -- Atribuir NSR sequencial
  IF NEW.nsr IS NULL THEN
    NEW.nsr := nextval('public.nsr_seq');
  END IF;
  
  -- Registrar horário do servidor
  NEW.horario_servidor := now();
  
  -- Gerar hash SHA-256 dos dados do registro
  hash_input := NEW.nsr::text || '|' || NEW.user_id::text || '|' || NEW.data::text || '|' || COALESCE(NEW.entrada::text, '') || '|' || NEW.horario_servidor::text;
  NEW.hash_registro := encode(digest(hash_input::bytea, 'sha256'), 'hex');
  
  RETURN NEW;
END;
$$;

-- Habilitar extensão pgcrypto para digest
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TRIGGER trigger_generate_nsr_hash
  BEFORE INSERT ON public.registros_ponto
  FOR EACH ROW EXECUTE FUNCTION public.generate_nsr_and_hash();
