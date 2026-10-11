# 🚀 Guia de Deploy — Controle de Ponto Pro

Este guia explica como migrar o projeto para um novo projeto Supabase independente.

---

## Pré-requisitos

- Node.js 18+ e npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalada (`npm i -g supabase`)
- Conta no [Supabase](https://supabase.com) com projeto criado
- Git

---

## 1. Clonar o Repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd <NOME_DO_PROJETO>
npm install
```

---

## 2. Configurar o Supabase CLI

```bash
supabase login
supabase link --project-ref <SEU_PROJECT_REF>
```

> O `project-ref` é o ID do seu projeto Supabase (visível na URL do dashboard: `https://supabase.com/dashboard/project/<project-ref>`).

---

## 3. Aplicar Migrações do Banco de Dados

As migrações estão em `supabase/migrations/`. Execute:

```bash
supabase db push
```

Isso criará todas as tabelas, funções, triggers, enums e políticas RLS.

### Verificar após push:
- Tabelas: `profiles`, `user_roles`, `funcionarios`, `cargos`, `escalas`, `tipos_registro`, `registros_ponto`, `sessoes_ponto`, `banco_horas`, `ocorrencias`, `justificativas`, `configuracoes_ponto`, `configuracoes_sistema`, `audit_configuracoes`, `audit_entidades`, `face_descriptors`
- Enum: `app_role` (`admin`, `gestor`, `colaborador`)
- Funções: `has_role`, `handle_new_user`, `generate_nsr_and_hash`, `protect_registro_immutable`, `prevent_registro_delete`, `calcular_banco_horas_automatico`, `update_updated_at_column`
- Sequência: `nsr_seq`
- Extensão: `pgcrypto` (para `digest`)

---

## 4. Configurar Triggers

Se os triggers não forem criados automaticamente pelas migrações, execute manualmente:

```sql
-- Trigger para novos usuários (cria profile + role)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger para NSR e hash em registros de ponto
CREATE TRIGGER trg_generate_nsr_hash
  BEFORE INSERT ON public.registros_ponto
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_nsr_and_hash();

-- Trigger para proteger campos imutáveis
CREATE TRIGGER trg_protect_registro
  BEFORE UPDATE ON public.registros_ponto
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_registro_immutable();

-- Trigger para impedir exclusão
CREATE TRIGGER trg_prevent_delete
  BEFORE DELETE ON public.registros_ponto
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_registro_delete();

-- Trigger para calcular banco de horas automaticamente
CREATE TRIGGER trg_calcular_banco_horas
  AFTER INSERT OR UPDATE ON public.registros_ponto
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_banco_horas_automatico();

-- Triggers de updated_at (para cada tabela que tenha a coluna)
CREATE TRIGGER trg_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_cargos BEFORE UPDATE ON public.cargos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_escalas BEFORE UPDATE ON public.escalas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_funcionarios BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_registros_ponto BEFORE UPDATE ON public.registros_ponto FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_banco_horas BEFORE UPDATE ON public.banco_horas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_ocorrencias BEFORE UPDATE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_updated_at_justificativas BEFORE UPDATE ON public.justificativas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 5. Criar Storage Bucket

No dashboard do Supabase → Storage:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('face-photos', 'face-photos', true);
```

Ou via dashboard: criar bucket `face-photos` com acesso público.

### Políticas de Storage:

```sql
CREATE POLICY "Authenticated users can upload face photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'face-photos');

CREATE POLICY "Anyone can view face photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'face-photos');
```

---

## 6. Deploy das Edge Functions

```bash
supabase functions deploy registrar-ponto
supabase functions deploy registrar-ponto-facial
supabase functions deploy gerenciar-entidades
supabase functions deploy gerenciar-configuracoes
supabase functions deploy calcular-banco-horas
supabase functions deploy verificar-ausencias
```

### Configuração especial (`supabase/config.toml`):

As seguintes funções precisam de `verify_jwt = false` porque fazem autenticação internamente:

```toml
[functions.registrar-ponto-facial]
verify_jwt = false

[functions.calcular-banco-horas]
verify_jwt = false

[functions.verificar-ausencias]
verify_jwt = false

[functions.gerenciar-configuracoes]
verify_jwt = false
```

> **Nota:** `registrar-ponto` e `gerenciar-entidades` usam `verify_jwt = true` (padrão).

---

## 7. Configurar Variáveis de Ambiente (.env)

Crie o arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://<SEU_PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<SUA_ANON_KEY>
VITE_SUPABASE_PROJECT_ID=<SEU_PROJECT_REF>
```

> As Edge Functions já têm acesso automático a `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.

---

## 8. Configurar Secrets (se necessário)

Se a aplicação usar secrets customizados:

```bash
supabase secrets set NOME_DO_SECRET=valor
```

Secrets padrão do Supabase (já configurados automaticamente):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

---

## 9. Seed de Dados Iniciais

Após o primeiro deploy, insira as configurações padrão:

```sql
-- Configurações de ponto
INSERT INTO configuracoes_ponto (chave, valor, descricao) VALUES
  ('tolerancia_banco_horas', 10, 'Tolerância em minutos para considerar hora extra'),
  ('tolerancia_jornada_incompleta', 10, 'Tolerância em minutos para considerar jornada incompleta');

-- Configurações do sistema
INSERT INTO configuracoes_sistema (chave, valor, tipo, descricao) VALUES
  ('permitir_auto_cadastro', 'true', 'boolean', 'Permitir que novos usuários se cadastrem'),
  ('role_padrao_novos_usuarios', 'colaborador', 'select', 'Papel padrão para novos usuários'),
  ('exigir_confirmacao_email', 'true', 'boolean', 'Exigir confirmação de e-mail'),
  ('permitir_registro_sem_escala', 'false', 'boolean', 'Permitir registro de ponto sem escala vinculada'),
  ('tempo_sessao_minutos', '480', 'number', 'Tempo de sessão em minutos'),
  ('notificar_admin_novo_cadastro', 'true', 'boolean', 'Notificar admin em novo cadastro');

-- Sequência NSR
CREATE SEQUENCE IF NOT EXISTS public.nsr_seq START WITH 1;
```

---

## 10. Build e Deploy do Frontend

```bash
npm run build
```

O output será gerado em `dist/`. Hospede em qualquer serviço estático:
- **Vercel**: `vercel deploy`
- **Netlify**: arraste a pasta `dist/`
- **Lovable**: Publish via interface

---

## 11. Configurar Cron Jobs

Veja o arquivo `docs/CRON.md` para instruções detalhadas.

---

## 12. Primeiro Acesso

1. Acesse a aplicação
2. Registre o primeiro usuário — ele receberá role `admin` automaticamente
3. Configure escalas, cargos e tipos de registro
4. Cadastre funcionários via `/cadastro-funcionario`
5. Configure as tolerâncias em `/banco-horas`

---

## Checklist de Verificação

- [ ] Migrações aplicadas (`supabase db push`)
- [ ] Triggers criados e funcionando
- [ ] Edge Functions deployadas
- [ ] Storage bucket `face-photos` criado
- [ ] Variáveis `.env` configuradas
- [ ] Dados seed inseridos
- [ ] Primeiro usuário admin criado
- [ ] Cron jobs configurados (se aplicável)
- [ ] Teste de registro de ponto funcional
- [ ] Teste de reconhecimento facial funcional
