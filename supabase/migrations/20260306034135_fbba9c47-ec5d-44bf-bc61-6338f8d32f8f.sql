CREATE OR REPLACE FUNCTION public.calcular_banco_horas_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_carga_horaria interval;
  v_minutos_esperados integer;
  v_minutos_trabalhados integer;
  v_almoco_minutos integer;
  v_diferenca integer;
  v_tolerancia_bh integer;
  v_tolerancia_ji integer;
  v_tipo text;
  v_saldo integer;
  v_existing_bh uuid;
  v_existing_oc uuid;
  v_h_falta integer;
  v_m_falta integer;
  v_usou_escala boolean := true;
BEGIN
  -- Process only complete records with entry and exit
  IF NEW.status != 'completo' OR NEW.entrada IS NULL OR NEW.saida IS NULL THEN
    RETURN NEW;
  END IF;

  -- Try to get employee schedule
  SELECT e.carga_horaria_diaria
    INTO v_carga_horaria
  FROM public.funcionarios f
  JOIN public.escalas e ON e.id = f.escala_id
  WHERE f.user_id = NEW.user_id
  LIMIT 1;

  -- Fallback: if user has no linked escala, use 8h expected journey
  IF v_carga_horaria IS NULL THEN
    v_minutos_esperados := 480;
    v_usou_escala := false;
  ELSE
    v_minutos_esperados := EXTRACT(EPOCH FROM v_carga_horaria)::integer / 60;
  END IF;

  -- Worked minutes
  v_minutos_trabalhados := EXTRACT(EPOCH FROM (NEW.saida - NEW.entrada))::integer / 60;

  -- Subtract lunch break when present
  IF NEW.almoco_saida IS NOT NULL AND NEW.almoco_retorno IS NOT NULL THEN
    v_almoco_minutos := EXTRACT(EPOCH FROM (NEW.almoco_retorno - NEW.almoco_saida))::integer / 60;
    v_minutos_trabalhados := v_minutos_trabalhados - v_almoco_minutos;
  END IF;

  -- Tolerances
  SELECT COALESCE((SELECT valor FROM public.configuracoes_ponto WHERE chave = 'tolerancia_banco_horas'), 10)
    INTO v_tolerancia_bh;
  SELECT COALESCE((SELECT valor FROM public.configuracoes_ponto WHERE chave = 'tolerancia_jornada_incompleta'), 10)
    INTO v_tolerancia_ji;

  v_diferenca := v_minutos_trabalhados - v_minutos_esperados;
  v_tipo := 'normal';
  v_saldo := 0;

  IF v_diferenca > v_tolerancia_bh THEN
    v_tipo := 'hora_extra';
    v_saldo := v_diferenca;
  ELSIF v_diferenca < -v_tolerancia_ji THEN
    v_tipo := 'jornada_incompleta';
    v_saldo := v_diferenca;
  END IF;

  -- Upsert banco_horas
  SELECT id INTO v_existing_bh
  FROM public.banco_horas
  WHERE user_id = NEW.user_id AND data = NEW.data
  LIMIT 1;

  IF v_existing_bh IS NOT NULL THEN
    UPDATE public.banco_horas
      SET minutos_trabalhados = v_minutos_trabalhados,
          minutos_esperados = v_minutos_esperados,
          saldo_minutos = v_saldo,
          tipo = v_tipo,
          registro_ponto_id = NEW.id
    WHERE id = v_existing_bh;
  ELSE
    INSERT INTO public.banco_horas (user_id, registro_ponto_id, data, minutos_trabalhados, minutos_esperados, saldo_minutos, tipo)
    VALUES (NEW.user_id, NEW.id, NEW.data, v_minutos_trabalhados, v_minutos_esperados, v_saldo, v_tipo);
  END IF;

  -- Create occurrence for incomplete journey
  IF v_tipo = 'jornada_incompleta' THEN
    SELECT id INTO v_existing_oc
    FROM public.ocorrencias
    WHERE user_id = NEW.user_id AND data = NEW.data AND tipo = 'jornada_incompleta'
    LIMIT 1;

    IF v_existing_oc IS NULL THEN
      v_h_falta := ABS(v_diferenca) / 60;
      v_m_falta := ABS(v_diferenca) % 60;

      INSERT INTO public.ocorrencias (user_id, data, tipo, descricao, status)
      VALUES (
        NEW.user_id,
        NEW.data,
        'jornada_incompleta',
        CASE
          WHEN v_usou_escala THEN
            'Jornada incompleta: faltaram ' || v_h_falta || 'h' || LPAD(v_m_falta::text, 2, '0') || 'min para completar a carga horária da escala.'
          ELSE
            'Jornada incompleta: faltaram ' || v_h_falta || 'h' || LPAD(v_m_falta::text, 2, '0') || 'min. Usuário sem escala vinculada (base 8h).'
        END,
        'pendente'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;