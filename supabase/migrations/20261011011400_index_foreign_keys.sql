-- Add indexes to cover foreign keys used by joins and filters.
CREATE INDEX IF NOT EXISTS idx_banco_horas_registro_ponto_id ON public.banco_horas (registro_ponto_id);
CREATE INDEX IF NOT EXISTS idx_banco_horas_user_id ON public.banco_horas (user_id);
CREATE INDEX IF NOT EXISTS idx_escalas_tipo_registro_id ON public.escalas (tipo_registro_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_cargo_id ON public.funcionarios (cargo_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_escala_id ON public.funcionarios (escala_id);
CREATE INDEX IF NOT EXISTS idx_justificativas_aprovado_por ON public.justificativas (aprovado_por);
CREATE INDEX IF NOT EXISTS idx_justificativas_registro_ponto_id ON public.justificativas (registro_ponto_id);
CREATE INDEX IF NOT EXISTS idx_justificativas_user_id ON public.justificativas (user_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_aprovado_por ON public.ocorrencias (aprovado_por);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_user_id ON public.ocorrencias (user_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_ponto_registro_ponto_id ON public.sessoes_ponto (registro_ponto_id);
