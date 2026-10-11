# CLAUDE.md — Controle de Ponto Pro

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase Edge Functions (Deno runtime)
- **Banco:** PostgreSQL (Supabase)
- **Auth:** Supabase Auth (JWT + email/senha)
- **Storage:** Supabase Storage (bucket `face-photos`)

## Comandos

```bash
npm run dev        # Servidor de desenvolvimento
npm run build      # Build de produção
npm run test       # Rodar testes (vitest)
npm run lint       # Lint do código
```

## Estrutura

```
src/
├── components/ui/    # shadcn/ui — NÃO editar manualmente
├── components/       # Componentes do projeto
├── hooks/            # useAuth, useFaceApi, useTheme
├── integrations/supabase/  # client.ts e types.ts — NÃO editar (auto-gerados)
├── lib/              # Utilitários (invokeEntityAction, camera, registroPonto)
├── pages/            # Páginas (PascalCase)
└── main.tsx

supabase/
├── functions/        # Edge Functions (Deno)
├── migrations/       # NÃO editar
└── config.toml       # NÃO editar
```

## Regras Críticas

### Arquitetura
- **Toda lógica sensível** → Edge Function (Deno). Frontend NUNCA faz INSERT/UPDATE/DELETE direto.
- Frontend apenas lê (SELECT) + chama Edge Functions via `invokeEntityAction()`.
- Edge Functions: sem Node APIs (`process`, `fs`, `require`), sem Express, sem Axios.

### Segurança (obrigatório em toda Edge Function)
1. Validar header `Authorization` (Bearer token)
2. Validar JWT com Supabase
3. Verificar role do usuário (`admin`, `gestor`, `colaborador`)
4. Validar e sanitizar payload
5. Usar `SUPABASE_SERVICE_ROLE_KEY` apenas no backend

### Design System
- Usar tokens semânticos: `bg-background`, `text-foreground`, `bg-primary`, etc.
- **NUNCA** usar cores diretas (`bg-black`, `text-white`)
- Todas as cores em HSL via CSS variables

### Arquivos Protegidos (não editar)
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml`
- `supabase/migrations/`
- `.env`

## Roles

| Role | Acesso |
|------|--------|
| `admin` | Total |
| `gestor` | Aprovações + visualização ampliada |
| `colaborador` | Dados próprios + registro de ponto |

Roles armazenadas na tabela `user_roles` (nunca em `profiles`).
Verificação via função SQL `has_role(_user_id, _role)`.

## Padrão de Resposta (Edge Functions)

```
200: { "success": true, "data": {} }
400: { "success": false, "error": "Invalid payload" }
401: { "success": false, "error": "Unauthorized" }
403: { "success": false, "error": "Forbidden" }
500: { "success": false, "error": "Internal error" }
```

## Convenções

- Componentes/Pages: `PascalCase`
- Hooks: `camelCase` com prefixo `use`
- Edge Functions: `kebab-case`
- Tabelas: `snake_case`

## Skills

Skills detalhadas disponíveis em `.claude/skills/`:
- `criar-edge-function` — Template e regras para backend
- `chamar-edge-function` — Integração frontend
- `criar-pagina-protegida` — Páginas com auth
- `criar-migracao-banco` — Migrações SQL
- `sanitizacao-validacao` — Validação de inputs
- `adicionar-acao-entidades` — CRUD via gerenciar-entidades
- `configurar-rls` — Políticas RLS
- `estrutura-projeto` — Arquitetura geral
- `criar-componente-shadcn` — Componentes UI
- `debug-troubleshooting` — Resolução de erros
- `fluxo-registro-ponto` — Lógica de batida de ponto
- `cron-automacoes` — Jobs automáticos (pg_cron)

## Documentação

- `docs/API_REFERENCE.md` — Referência das Edge Functions
- `docs/DEPLOY.md` — Deploy e configuração
- `docs/CRON.md` — Jobs agendados
- `docs/FICHA_TECNICA.md` — Especificações técnicas
- `docs/FUNCIONALIDADES.md` — Lista de funcionalidades
- `docs/AUDITORIA_SEGURANCA.md` — Auditoria de segurança
