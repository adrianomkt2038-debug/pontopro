---
name: estrutura-projeto
description: Documenta a estrutura, convenções e arquitetura do projeto. Use como referência ao navegar ou entender o codebase.
---

# Estrutura e Convenções do Projeto

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase Edge Functions (Deno runtime)
- **Banco:** PostgreSQL (Supabase)
- **Auth:** Supabase Auth (JWT + email/senha)
- **Storage:** Supabase Storage (bucket `face-photos`)

## Estrutura de Diretórios

```
src/
├── components/
│   ├── ui/              # shadcn/ui (NÃO editar)
│   ├── AppLayout.tsx
│   ├── AppSidebar.tsx
│   └── ...
├── hooks/
│   ├── useAuth.tsx       # Auth + roles
│   ├── useFaceApi.tsx    # Reconhecimento facial
│   └── useTheme.tsx
├── integrations/supabase/
│   ├── client.ts         # ⚠️ NÃO EDITAR (auto-gerado)
│   └── types.ts          # ⚠️ NÃO EDITAR (auto-gerado)
├── lib/
│   ├── invokeEntityAction.ts
│   ├── camera.ts
│   ├── registroPonto.ts
│   └── utils.ts
├── pages/
└── main.tsx

supabase/
├── functions/            # Edge Functions (Deno)
├── migrations/           # ⚠️ NÃO EDITAR
└── config.toml           # ⚠️ NÃO EDITAR
```

## Convenções

- Componentes: PascalCase — Hooks: camelCase com `use` — Pages: PascalCase
- Edge Functions: kebab-case — Tabelas: snake_case
- Design: tokens semânticos (`bg-background`, `text-foreground`), NUNCA cores diretas

## Roles

- `admin`: acesso total
- `gestor`: aprovações e visualização ampliada
- `colaborador`: dados próprios + registro de ponto

## Regra de Ouro

- Toda lógica sensível → Edge Function
- Frontend apenas lê (SELECT) + chama Edge Functions
