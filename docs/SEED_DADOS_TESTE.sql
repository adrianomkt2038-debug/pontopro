-- ============================================================
-- DADOS FICTÍCIOS PARA TESTE — Controle de Ponto Pro
-- ============================================================
-- IMPORTANTE: Execute este script APÓS as migrações e APÓS
-- criar o primeiro usuário admin via interface.
--
-- Este script usa o service_role para criar usuários via
-- auth.users. Se estiver rodando no SQL Editor do Supabase,
-- ele já tem permissão.
--
-- Os UUIDs são fixos para facilitar referências cruzadas.
-- ============================================================

-- ============================================================
-- 1. CARGOS
-- ============================================================
INSERT INTO public.cargos (id, nome, descricao, nivel) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Diretor', 'Diretor geral da empresa', 10),
  ('a0000001-0000-0000-0000-000000000002', 'Gerente', 'Gerente de departamento', 8),
  ('a0000001-0000-0000-0000-000000000003', 'Coordenador', 'Coordenador de equipe', 6),
  ('a0000001-0000-0000-0000-000000000004', 'Analista Senior', 'Analista com experiência avançada', 5),
  ('a0000001-0000-0000-0000-000000000005', 'Analista Pleno', 'Analista com experiência intermediária', 4),
  ('a0000001-0000-0000-0000-000000000006', 'Analista Junior', 'Analista iniciante', 3),
  ('a0000001-0000-0000-0000-000000000007', 'Estagiário', 'Estagiário em formação', 1),
  ('a0000001-0000-0000-0000-000000000008', 'Assistente Administrativo', 'Suporte administrativo', 2),
  ('a0000001-0000-0000-0000-000000000009', 'Desenvolvedor', 'Desenvolvedor de software', 5),
  ('a0000001-0000-0000-0000-000000000010', 'Designer', 'Designer de interfaces', 4)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. TIPOS DE REGISTRO
-- ============================================================
INSERT INTO public.tipos_registro (id, nome, descricao, batidas) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'Padrão 4 batidas', 'Entrada, almoço saída, almoço retorno, saída', '{entrada,almoco_saida,almoco_retorno,saida}'),
  ('b0000001-0000-0000-0000-000000000002', 'Simples 2 batidas', 'Apenas entrada e saída', '{entrada,saida}'),
  ('b0000001-0000-0000-0000-000000000003', 'Completo 6 batidas', 'Entrada, almoço, intervalo extra, saída', '{entrada,almoco_saida,almoco_retorno,intervalo_1_saida,intervalo_1_retorno,saida}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. ESCALAS
-- ============================================================
INSERT INTO public.escalas (id, nome, descricao, hora_entrada, hora_saida, hora_almoco_inicio, hora_almoco_fim, dias_semana, carga_horaria_diaria, tipo_registro_id) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Comercial 8h', 'Horário comercial padrão', '08:00:00', '17:00:00', '12:00:00', '13:00:00', '{1,2,3,4,5}', '08:00:00', 'b0000001-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000002', 'Manhã 6h', 'Turno da manhã', '06:00:00', '12:00:00', '09:00:00', '09:15:00', '{1,2,3,4,5}', '06:00:00', 'b0000001-0000-0000-0000-000000000002'),
  ('c0000001-0000-0000-0000-000000000003', 'Tarde 6h', 'Turno da tarde', '12:00:00', '18:00:00', '15:00:00', '15:15:00', '{1,2,3,4,5}', '06:00:00', 'b0000001-0000-0000-0000-000000000002'),
  ('c0000001-0000-0000-0000-000000000004', 'Flexível 8h', 'Horário flexível com almoço', '09:00:00', '18:00:00', '12:30:00', '13:30:00', '{1,2,3,4,5}', '08:00:00', 'b0000001-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000005', 'Escala 12x36', 'Trabalha 12h, folga 36h', '07:00:00', '19:00:00', '12:00:00', '13:00:00', '{1,3,5}', '11:00:00', 'b0000001-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. CONFIGURAÇÕES DE PONTO
-- ============================================================
INSERT INTO public.configuracoes_ponto (chave, valor, descricao) VALUES
  ('tolerancia_banco_horas', 10, 'Tolerância em minutos para considerar hora extra'),
  ('tolerancia_jornada_incompleta', 10, 'Tolerância em minutos para considerar jornada incompleta')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. CONFIGURAÇÕES DO SISTEMA
-- ============================================================
INSERT INTO public.configuracoes_sistema (chave, valor, tipo, descricao) VALUES
  ('permitir_auto_cadastro', 'true', 'boolean', 'Permitir que novos usuários se cadastrem'),
  ('role_padrao_novos_usuarios', 'colaborador', 'select', 'Papel padrão para novos usuários'),
  ('exigir_confirmacao_email', 'false', 'boolean', 'Exigir confirmação de e-mail'),
  ('permitir_registro_sem_escala', 'true', 'boolean', 'Permitir registro de ponto sem escala vinculada'),
  ('tempo_sessao_minutos', '480', 'number', 'Tempo de sessão em minutos'),
  ('notificar_admin_novo_cadastro', 'true', 'boolean', 'Notificar admin em novo cadastro')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. USUÁRIOS DE TESTE (via auth.users)
-- ============================================================
-- NOTA: Estes inserts criam usuários diretamente no auth.users.
-- O trigger handle_new_user criará automaticamente profiles e user_roles.
-- Senha para todos: Test@1234
--
-- Se o trigger handle_new_user já existir, os profiles e roles serão
-- criados automaticamente. Caso contrário, veja a seção 7.
-- ============================================================

-- Usuário Admin (se ainda não existir um)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'd0000001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'admin@pontopro.test',
  crypt('Test@1234', gen_salt('bf')),
  now(), now(), now(),
  '{"full_name": "Carlos Admin"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Gestor
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'd0000001-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'gestor@pontopro.test',
  crypt('Test@1234', gen_salt('bf')),
  now(), now(), now(),
  '{"full_name": "Ana Gestora"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Colaboradores
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES
  ('d0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'joao.silva@pontopro.test', crypt('Test@1234', gen_salt('bf')), now(), now(), now(), '{"full_name": "João Silva"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maria.santos@pontopro.test', crypt('Test@1234', gen_salt('bf')), now(), now(), now(), '{"full_name": "Maria Santos"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pedro.oliveira@pontopro.test', crypt('Test@1234', gen_salt('bf')), now(), now(), now(), '{"full_name": "Pedro Oliveira"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lucia.ferreira@pontopro.test', crypt('Test@1234', gen_salt('bf')), now(), now(), now(), '{"full_name": "Lúcia Ferreira"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rafael.costa@pontopro.test', crypt('Test@1234', gen_salt('bf')), now(), now(), now(), '{"full_name": "Rafael Costa"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'camila.souza@pontopro.test', crypt('Test@1234', gen_salt('bf')), now(), now(), now(), '{"full_name": "Camila Souza"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bruno.lima@pontopro.test', crypt('Test@1234', gen_salt('bf')), now(), now(), now(), '{"full_name": "Bruno Lima"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fernanda.rocha@pontopro.test', crypt('Test@1234', gen_salt('bf')), now(), now(), now(), '{"full_name": "Fernanda Rocha"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'thiago.mendes@pontopro.test', crypt('Test@1234', gen_salt('bf')), now(), now(), now(), '{"full_name": "Thiago Mendes"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'juliana.alves@pontopro.test', crypt('Test@1234', gen_salt('bf')), now(), now(), now(), '{"full_name": "Juliana Alves"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Identities (necessárias para login via email)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('d0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'admin@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000001","email":"admin@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000002', 'gestor@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000002","email":"gestor@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000003', 'joao.silva@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000003","email":"joao.silva@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000004', 'maria.santos@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000004","email":"maria.santos@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000005', 'pedro.oliveira@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000005","email":"pedro.oliveira@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000006', 'lucia.ferreira@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000006","email":"lucia.ferreira@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000007', 'd0000001-0000-0000-0000-000000000007', 'rafael.costa@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000007","email":"rafael.costa@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000008', 'd0000001-0000-0000-0000-000000000008', 'camila.souza@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000008","email":"camila.souza@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000009', 'd0000001-0000-0000-0000-000000000009', 'bruno.lima@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000009","email":"bruno.lima@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000010', 'd0000001-0000-0000-0000-000000000010', 'fernanda.rocha@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000010","email":"fernanda.rocha@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000011', 'd0000001-0000-0000-0000-000000000011', 'thiago.mendes@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000011","email":"thiago.mendes@pontopro.test"}'::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000012', 'd0000001-0000-0000-0000-000000000012', 'juliana.alves@pontopro.test', '{"sub":"d0000001-0000-0000-0000-000000000012","email":"juliana.alves@pontopro.test"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. PROFILES (caso o trigger não tenha criado)
-- ============================================================
INSERT INTO public.profiles (user_id, full_name, email, matricula, active) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'Carlos Admin', 'admin@pontopro.test', 'ADM001', true),
  ('d0000001-0000-0000-0000-000000000002', 'Ana Gestora', 'gestor@pontopro.test', 'GES001', true),
  ('d0000001-0000-0000-0000-000000000003', 'João Silva', 'joao.silva@pontopro.test', 'COL001', true),
  ('d0000001-0000-0000-0000-000000000004', 'Maria Santos', 'maria.santos@pontopro.test', 'COL002', true),
  ('d0000001-0000-0000-0000-000000000005', 'Pedro Oliveira', 'pedro.oliveira@pontopro.test', 'COL003', true),
  ('d0000001-0000-0000-0000-000000000006', 'Lúcia Ferreira', 'lucia.ferreira@pontopro.test', 'COL004', true),
  ('d0000001-0000-0000-0000-000000000007', 'Rafael Costa', 'rafael.costa@pontopro.test', 'COL005', true),
  ('d0000001-0000-0000-0000-000000000008', 'Camila Souza', 'camila.souza@pontopro.test', 'COL006', true),
  ('d0000001-0000-0000-0000-000000000009', 'Bruno Lima', 'bruno.lima@pontopro.test', 'COL007', true),
  ('d0000001-0000-0000-0000-000000000010', 'Fernanda Rocha', 'fernanda.rocha@pontopro.test', 'COL008', true),
  ('d0000001-0000-0000-0000-000000000011', 'Thiago Mendes', 'thiago.mendes@pontopro.test', 'EST001', true),
  ('d0000001-0000-0000-0000-000000000012', 'Juliana Alves', 'juliana.alves@pontopro.test', 'EST002', true)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 8. USER ROLES
-- ============================================================
-- Limpar roles duplicadas antes de inserir
DELETE FROM public.user_roles WHERE user_id IN (
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

INSERT INTO public.user_roles (user_id, role) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'admin'),
  ('d0000001-0000-0000-0000-000000000002', 'gestor'),
  ('d0000001-0000-0000-0000-000000000003', 'colaborador'),
  ('d0000001-0000-0000-0000-000000000004', 'colaborador'),
  ('d0000001-0000-0000-0000-000000000005', 'colaborador'),
  ('d0000001-0000-0000-0000-000000000006', 'colaborador'),
  ('d0000001-0000-0000-0000-000000000007', 'colaborador'),
  ('d0000001-0000-0000-0000-000000000008', 'colaborador'),
  ('d0000001-0000-0000-0000-000000000009', 'colaborador'),
  ('d0000001-0000-0000-0000-000000000010', 'colaborador'),
  ('d0000001-0000-0000-0000-000000000011', 'colaborador'),
  ('d0000001-0000-0000-0000-000000000012', 'colaborador');

-- ============================================================
-- 9. FUNCIONÁRIOS
-- ============================================================
INSERT INTO public.funcionarios (user_id, cargo_id, escala_id, data_admissao) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', '2024-01-15'),
  ('d0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', '2024-02-01'),
  ('d0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001', '2024-03-10'),
  ('d0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000001', '2024-04-01'),
  ('d0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000009', 'c0000001-0000-0000-0000-000000000004', '2024-05-15'),
  ('d0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000002', '2024-06-01'),
  ('d0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000009', 'c0000001-0000-0000-0000-000000000004', '2024-07-10'),
  ('d0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000010', 'c0000001-0000-0000-0000-000000000001', '2024-08-01'),
  ('d0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000001', '2024-09-01'),
  ('d0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000003', '2024-10-15'),
  ('d0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000002', '2025-01-10'),
  ('d0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000003', '2025-02-01')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 10. REGISTROS DE PONTO (últimos 14 dias úteis)
-- ============================================================
-- Nota: Os triggers (NSR, hash) serão aplicados automaticamente.
-- Geramos registros completos e alguns parciais/ausentes.

-- Helper: gerar timestamps a partir de data + hora
-- Formato: data || 'T' || hora || ':00-03:00' (BRT)

DO $$
DECLARE
  d date;
  day_offset integer;
  user_ids uuid[] := ARRAY[
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
  ];
  uid uuid;
  entrada_time timestamptz;
  almoco_s_time timestamptz;
  almoco_r_time timestamptz;
  saida_time timestamptz;
  rand_min integer;
  skip_chance double precision;
  incomplete_chance double precision;
  extra_chance double precision;
  worked_min integer;
  saldo integer;
  rec_status text;
BEGIN
  -- Percorrer os últimos 20 dias (pegar ~14 úteis)
  FOR day_offset IN 1..20 LOOP
    d := CURRENT_DATE - day_offset;

    -- Pular fins de semana
    IF EXTRACT(DOW FROM d) IN (0, 6) THEN
      CONTINUE;
    END IF;

    FOREACH uid IN ARRAY user_ids LOOP
      -- Chance de faltar (~8%)
      skip_chance := random();
      IF skip_chance < 0.08 THEN
        CONTINUE;
      END IF;

      -- Variação de entrada: 07:50 a 08:15
      rand_min := floor(random() * 25)::integer - 10; -- -10 a +14
      entrada_time := (d::text || 'T08:00:00-03:00')::timestamptz + (rand_min || ' minutes')::interval;

      -- Almoço saída: 11:55 a 12:10
      rand_min := floor(random() * 15)::integer - 5;
      almoco_s_time := (d::text || 'T12:00:00-03:00')::timestamptz + (rand_min || ' minutes')::interval;

      -- Almoço retorno: 12:55 a 13:15
      rand_min := floor(random() * 20)::integer - 5;
      almoco_r_time := (d::text || 'T13:00:00-03:00')::timestamptz + (rand_min || ' minutes')::interval;

      -- Saída: 16:45 a 17:30
      extra_chance := random();
      IF extra_chance < 0.15 THEN
        -- Hora extra (saída 17:30-18:30)
        rand_min := floor(random() * 60)::integer + 30;
      ELSIF extra_chance < 0.25 THEN
        -- Saída antecipada (16:00-16:45)
        rand_min := floor(random() * 45)::integer - 60;
      ELSE
        -- Normal (16:50-17:10)
        rand_min := floor(random() * 20)::integer - 10;
      END IF;
      saida_time := (d::text || 'T17:00:00-03:00')::timestamptz + (rand_min || ' minutes')::interval;

      -- Chance de registro incompleto (~5%)
      incomplete_chance := random();

      IF incomplete_chance < 0.05 THEN
        -- Apenas entrada (em_andamento)
        INSERT INTO public.registros_ponto (user_id, data, entrada, status, terminal_id)
        VALUES (uid, d, entrada_time, 'em_andamento', 'web-app')
        ON CONFLICT DO NOTHING;
      ELSE
        -- Registro completo
        worked_min := EXTRACT(EPOCH FROM (saida_time - entrada_time))::integer / 60;
        worked_min := worked_min - (EXTRACT(EPOCH FROM (almoco_r_time - almoco_s_time))::integer / 60);
        saldo := worked_min - 480;

        INSERT INTO public.registros_ponto (user_id, data, entrada, almoco_saida, almoco_retorno, saida, status, saldo_minutos, terminal_id)
        VALUES (uid, d, entrada_time, almoco_s_time, almoco_r_time, saida_time, 'completo', saldo, 'web-app')
        ON CONFLICT DO NOTHING;
      END IF;

    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 11. BANCO DE HORAS (calculado a partir dos registros)
-- ============================================================
-- O trigger calcular_banco_horas_automatico deve ter criado estes
-- registros automaticamente. Se não, executar manualmente:

INSERT INTO public.banco_horas (user_id, data, registro_ponto_id, minutos_trabalhados, minutos_esperados, saldo_minutos, tipo)
SELECT
  rp.user_id,
  rp.data,
  rp.id,
  CASE
    WHEN rp.saida IS NOT NULL AND rp.entrada IS NOT NULL THEN
      EXTRACT(EPOCH FROM (rp.saida - rp.entrada))::integer / 60
      - COALESCE(
        CASE WHEN rp.almoco_saida IS NOT NULL AND rp.almoco_retorno IS NOT NULL
          THEN EXTRACT(EPOCH FROM (rp.almoco_retorno - rp.almoco_saida))::integer / 60
          ELSE 0
        END, 0)
    ELSE 0
  END AS minutos_trabalhados,
  480 AS minutos_esperados,
  CASE
    WHEN rp.saida IS NOT NULL AND rp.entrada IS NOT NULL THEN
      (EXTRACT(EPOCH FROM (rp.saida - rp.entrada))::integer / 60
      - COALESCE(
        CASE WHEN rp.almoco_saida IS NOT NULL AND rp.almoco_retorno IS NOT NULL
          THEN EXTRACT(EPOCH FROM (rp.almoco_retorno - rp.almoco_saida))::integer / 60
          ELSE 0
        END, 0)) - 480
    ELSE 0
  END AS saldo,
  CASE
    WHEN rp.saida IS NOT NULL AND rp.entrada IS NOT NULL THEN
      CASE
        WHEN (EXTRACT(EPOCH FROM (rp.saida - rp.entrada))::integer / 60
          - COALESCE(
            CASE WHEN rp.almoco_saida IS NOT NULL AND rp.almoco_retorno IS NOT NULL
              THEN EXTRACT(EPOCH FROM (rp.almoco_retorno - rp.almoco_saida))::integer / 60
              ELSE 0
            END, 0)) - 480 > 10 THEN 'hora_extra'
        WHEN (EXTRACT(EPOCH FROM (rp.saida - rp.entrada))::integer / 60
          - COALESCE(
            CASE WHEN rp.almoco_saida IS NOT NULL AND rp.almoco_retorno IS NOT NULL
              THEN EXTRACT(EPOCH FROM (rp.almoco_retorno - rp.almoco_saida))::integer / 60
              ELSE 0
            END, 0)) - 480 < -10 THEN 'jornada_incompleta'
        ELSE 'normal'
      END
    ELSE 'normal'
  END AS tipo
FROM public.registros_ponto rp
WHERE rp.status = 'completo'
  AND rp.user_id::text LIKE 'd0000001-0000-0000-0000-%'
  AND NOT EXISTS (
    SELECT 1 FROM public.banco_horas bh
    WHERE bh.user_id = rp.user_id AND bh.data = rp.data
  );

-- ============================================================
-- 12. OCORRÊNCIAS
-- ============================================================
INSERT INTO public.ocorrencias (user_id, data, tipo, descricao, status) VALUES
  -- Faltas
  ('d0000001-0000-0000-0000-000000000003', CURRENT_DATE - 3, 'falta', 'Ausência: nenhuma batida registrada durante a jornada de trabalho.', 'pendente'),
  ('d0000001-0000-0000-0000-000000000007', CURRENT_DATE - 5, 'falta', 'Ausência: nenhuma batida registrada durante a jornada de trabalho.', 'pendente'),
  ('d0000001-0000-0000-0000-000000000011', CURRENT_DATE - 7, 'falta', 'Ausência sem justificativa.', 'aprovada'),

  -- Atrasos
  ('d0000001-0000-0000-0000-000000000004', CURRENT_DATE - 2, 'jornada_incompleta', 'Jornada incompleta: faltaram 0h45min para completar a carga horária.', 'pendente'),
  ('d0000001-0000-0000-0000-000000000006', CURRENT_DATE - 4, 'jornada_incompleta', 'Jornada incompleta: faltaram 1h20min para completar a carga horária.', 'rejeitada'),

  -- Advertências
  ('d0000001-0000-0000-0000-000000000005', CURRENT_DATE - 6, 'advertencia', 'Advertência verbal por atrasos recorrentes na última semana.', 'aprovada'),
  ('d0000001-0000-0000-0000-000000000009', CURRENT_DATE - 8, 'advertencia', 'Advertência por não registrar ponto de saída por 3 dias consecutivos.', 'pendente'),

  -- Horas extras
  ('d0000001-0000-0000-0000-000000000003', CURRENT_DATE - 1, 'hora_extra', 'Hora extra autorizada: projeto urgente de deploy.', 'aprovada'),
  ('d0000001-0000-0000-0000-000000000008', CURRENT_DATE - 2, 'hora_extra', 'Hora extra: finalização de relatório trimestral.', 'pendente'),
  ('d0000001-0000-0000-0000-000000000010', CURRENT_DATE - 3, 'hora_extra', 'Hora extra autorizada pelo gestor para entrega de sprint.', 'aprovada'),

  -- Elogios
  ('d0000001-0000-0000-0000-000000000004', CURRENT_DATE - 10, 'elogio', 'Elogio por pontualidade exemplar durante todo o mês.', 'aprovada'),
  ('d0000001-0000-0000-0000-000000000008', CURRENT_DATE - 12, 'elogio', 'Destaque por produtividade e comprometimento com horários.', 'aprovada')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. JUSTIFICATIVAS
-- ============================================================
INSERT INTO public.justificativas (user_id, data, tipo, descricao, status) VALUES
  ('d0000001-0000-0000-0000-000000000003', CURRENT_DATE - 3, 'falta', 'Consulta médica de emergência. Atestado será enviado.', 'pendente'),
  ('d0000001-0000-0000-0000-000000000007', CURRENT_DATE - 5, 'falta', 'Problema familiar urgente. Solicito abono da falta.', 'pendente'),
  ('d0000001-0000-0000-0000-000000000004', CURRENT_DATE - 2, 'saida_antecipada', 'Saí mais cedo por mal-estar. Atestado médico em anexo.', 'aprovada'),
  ('d0000001-0000-0000-0000-000000000006', CURRENT_DATE - 4, 'atraso', 'Atraso devido a acidente no trânsito. Registro policial disponível.', 'rejeitada'),
  ('d0000001-0000-0000-0000-000000000005', CURRENT_DATE - 6, 'atestado', 'Atestado médico de 1 dia por gripe.', 'aprovada'),
  ('d0000001-0000-0000-0000-000000000009', CURRENT_DATE - 8, 'outros', 'Participação em audiência judicial convocada. Comprovante anexo.', 'pendente'),
  ('d0000001-0000-0000-0000-000000000011', CURRENT_DATE - 7, 'falta', 'Fui ao dentista, atestado de comparecimento.', 'aprovada'),
  ('d0000001-0000-0000-0000-000000000012', CURRENT_DATE - 9, 'atraso', 'Ônibus quebrou no caminho para o trabalho.', 'pendente'),
  ('d0000001-0000-0000-0000-000000000010', CURRENT_DATE - 1, 'saida_antecipada', 'Precisei buscar filho na escola por emergência.', 'pendente'),
  ('d0000001-0000-0000-0000-000000000008', CURRENT_DATE - 3, 'atestado', 'Atestado médico de 2 dias por procedimento odontológico.', 'aprovada')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 14. SESSÕES DE PONTO (amostra)
-- ============================================================
INSERT INTO public.sessoes_ponto (user_id, registro_ponto_id, acao, ip_address, city, country_code, latitude, longitude, user_agent, sistema_operacional)
SELECT
  rp.user_id,
  rp.id,
  'entrada',
  '189.1.' || floor(random() * 255)::text || '.' || floor(random() * 255)::text,
  CASE floor(random() * 5)::integer
    WHEN 0 THEN 'São Paulo'
    WHEN 1 THEN 'Rio de Janeiro'
    WHEN 2 THEN 'Belo Horizonte'
    WHEN 3 THEN 'Curitiba'
    ELSE 'Brasília'
  END,
  'br',
  -23.5505 + (random() * 10 - 5),
  -46.6333 + (random() * 10 - 5),
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  CASE floor(random() * 4)::integer
    WHEN 0 THEN 'Windows'
    WHEN 1 THEN 'macOS'
    WHEN 2 THEN 'Android'
    ELSE 'iOS'
  END
FROM public.registros_ponto rp
WHERE rp.user_id::text LIKE 'd0000001-0000-0000-0000-%'
  AND rp.entrada IS NOT NULL
LIMIT 80;

-- ============================================================
-- 15. AUDIT LOG (amostra)
-- ============================================================
INSERT INTO public.audit_entidades (user_id, action, entity_type, entity_id, details) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'cargo_create', 'cargo', 'a0000001-0000-0000-0000-000000000001', '{"nome": "Diretor", "nivel": 10}'::jsonb),
  ('d0000001-0000-0000-0000-000000000001', 'escala_create', 'escala', 'c0000001-0000-0000-0000-000000000001', '{"nome": "Comercial 8h"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000001', 'admin_create_funcionario', 'funcionario', 'd0000001-0000-0000-0000-000000000003', '{"full_name": "João Silva", "email": "joao.silva@pontopro.test"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000001', 'admin_create_funcionario', 'funcionario', 'd0000001-0000-0000-0000-000000000004', '{"full_name": "Maria Santos", "email": "maria.santos@pontopro.test"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000001', 'users_update', 'usuario', 'd0000001-0000-0000-0000-000000000002', '{"full_name": "Ana Gestora", "role": "gestor", "active": true}'::jsonb),
  ('d0000001-0000-0000-0000-000000000001', 'ocorrencia_approve', 'ocorrencia', null, '{}'::jsonb),
  ('d0000001-0000-0000-0000-000000000001', 'justificativa_approve', 'justificativa', null, '{}'::jsonb),
  ('d0000001-0000-0000-0000-000000000001', 'configuracoes_ponto_update', 'configuracoes_ponto', null, '{"tolerancia_banco_horas": 10, "tolerancia_jornada_incompleta": 10}'::jsonb),
  ('d0000001-0000-0000-0000-000000000002', 'ocorrencia_create', 'ocorrencia', null, '{"tipo": "advertencia", "target_user_id": "d0000001-0000-0000-0000-000000000005"}'::jsonb),
  ('d0000001-0000-0000-0000-000000000001', 'tipo_registro_create', 'tipo_registro', 'b0000001-0000-0000-0000-000000000001', '{"nome": "Padrão 4 batidas"}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================
-- RESUMO DOS DADOS INSERIDOS
-- ============================================================
-- 
-- CREDENCIAIS DE TESTE:
-- ┌────────────────────────────────┬──────────────┬─────────────┐
-- │ E-mail                         │ Senha        │ Role        │
-- ├────────────────────────────────┼──────────────┼─────────────┤
-- │ admin@pontopro.test            │ Test@1234    │ admin       │
-- │ gestor@pontopro.test           │ Test@1234    │ gestor      │
-- │ joao.silva@pontopro.test       │ Test@1234    │ colaborador │
-- │ maria.santos@pontopro.test     │ Test@1234    │ colaborador │
-- │ pedro.oliveira@pontopro.test   │ Test@1234    │ colaborador │
-- │ lucia.ferreira@pontopro.test   │ Test@1234    │ colaborador │
-- │ rafael.costa@pontopro.test     │ Test@1234    │ colaborador │
-- │ camila.souza@pontopro.test     │ Test@1234    │ colaborador │
-- │ bruno.lima@pontopro.test       │ Test@1234    │ colaborador │
-- │ fernanda.rocha@pontopro.test   │ Test@1234    │ colaborador │
-- │ thiago.mendes@pontopro.test    │ Test@1234    │ colaborador │
-- │ juliana.alves@pontopro.test    │ Test@1234    │ colaborador │
-- └────────────────────────────────┴──────────────┴─────────────┘
--
-- DADOS GERADOS:
-- • 10 cargos
-- • 3 tipos de registro
-- • 5 escalas
-- • 12 usuários (1 admin, 1 gestor, 10 colaboradores)
-- • 12 funcionários com cargo e escala vinculados
-- • ~140+ registros de ponto (últimos 14 dias úteis)
-- • Banco de horas calculado automaticamente
-- • 12 ocorrências (faltas, advertências, horas extras, elogios)
-- • 10 justificativas (diversos tipos e status)
-- • ~80 sessões de ponto com dados de geolocalização
-- • 10 registros de auditoria
-- • Configurações de ponto e sistema
--
-- EXECUTE NO SQL EDITOR DO SUPABASE DASHBOARD
-- ============================================================
