ALTER TABLE public.ocorrencias DROP CONSTRAINT IF EXISTS ocorrencias_tipo_check;

ALTER TABLE public.ocorrencias
ADD CONSTRAINT ocorrencias_tipo_check
CHECK (
  tipo = ANY (
    ARRAY[
      'hora_extra'::text,
      'banco_horas'::text,
      'advertencia'::text,
      'outros'::text,
      'jornada_incompleta'::text,
      'atraso'::text,
      'falta'::text
    ]
  )
);
