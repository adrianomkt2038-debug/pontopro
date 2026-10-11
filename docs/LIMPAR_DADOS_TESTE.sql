-- ============================================================
-- LIMPEZA DE DADOS DE TESTE — Controle de Ponto Pro
-- ============================================================
-- Este script remove TODOS os dados fictícios inseridos pelo
-- SEED_DADOS_TESTE.sql, preservando dados reais (se houver).
--
-- Execução: SQL Editor do Supabase Dashboard
-- ============================================================

-- ============================================================
-- 1. REMOVER DADOS VINCULADOS (ordem de dependência)
-- ============================================================

-- Audit logs
DELETE FROM public.audit_entidades
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

DELETE FROM public.audit_configuracoes
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

-- Sessões de ponto
DELETE FROM public.sessoes_ponto
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

-- Banco de horas
DELETE FROM public.banco_horas
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

-- Justificativas
DELETE FROM public.justificativas
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

-- Ocorrências
DELETE FROM public.ocorrencias
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

-- Registros de ponto (trigger impede DELETE, desabilitar temporariamente)
ALTER TABLE public.registros_ponto DISABLE TRIGGER trg_prevent_delete;

DELETE FROM public.registros_ponto
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

ALTER TABLE public.registros_ponto ENABLE TRIGGER trg_prevent_delete;

-- Face descriptors
DELETE FROM public.face_descriptors
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

-- Funcionários
DELETE FROM public.funcionarios
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

-- User roles
DELETE FROM public.user_roles
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

-- Profiles
DELETE FROM public.profiles
WHERE user_id LIKE 'd0000001-0000-0000-0000-%';

-- ============================================================
-- 2. REMOVER USUÁRIOS AUTH
-- ============================================================
DELETE FROM auth.identities
WHERE user_id IN (
  'd0000001-0000-0000-0000-000000000001',
  'd0000001-0000-0000-0000-000000000002',
  'd0000001-0000-0000-0000-000000000003',
  'd0000001-0000-0000-0000-000000000004',
  'd0000001-0000-0000-0000-000000000005',
  'd0000001-0000-0000-0000-000000000006',
  'd0000001-0000-0000-0000-000000000007',
  'd0000001-0000-0000-0000-000000000008',
  'd0000001-0000-0000-0000-000000000009',
  'd0000001-0000-0000-0000-000000000010',
  'd0000001-0000-0000-0000-000000000011',
  'd0000001-0000-0000-0000-000000000012'
);

DELETE FROM auth.users
WHERE id LIKE 'd0000001-0000-0000-0000-%';

-- ============================================================
-- 3. REMOVER ENTIDADES DE REFERÊNCIA
-- ============================================================

-- Escalas de teste
DELETE FROM public.escalas
WHERE id LIKE 'c0000001-0000-0000-0000-%';

-- Tipos de registro de teste
DELETE FROM public.tipos_registro
WHERE id LIKE 'b0000001-0000-0000-0000-%';

-- Cargos de teste
DELETE FROM public.cargos
WHERE id LIKE 'a0000001-0000-0000-0000-%';

-- ============================================================
-- 4. LIMPAR CONFIGURAÇÕES DE TESTE (opcional)
-- ============================================================
-- Descomente as linhas abaixo se quiser resetar as configurações:
--
-- DELETE FROM public.configuracoes_ponto;
-- DELETE FROM public.configuracoes_sistema;

-- ============================================================
-- RESUMO
-- ============================================================
-- Dados removidos:
-- • 12 usuários (auth.users + auth.identities)
-- • 12 profiles
-- • 12 user_roles
-- • 12 funcionários
-- • ~140+ registros de ponto
-- • Banco de horas associado
-- • Sessões de ponto
-- • Ocorrências e justificativas
-- • Logs de auditoria
-- • 10 cargos, 5 escalas, 3 tipos de registro
--
-- Dados PRESERVADOS:
-- • Usuários reais (não-teste)
-- • Configurações do sistema (a menos que descomentado)
-- • Sequência NSR (não resetada)
-- ============================================================
