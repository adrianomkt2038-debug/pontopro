# 🛠️ Ficha Técnica — Controle de Ponto Pro

---

## Stack Principal

| Camada | Tecnologia | Versão | Função |
|---|---|---|---|
| **Frontend** | React | ^18.3.1 | Biblioteca de UI reativa |
| **Bundler** | Vite | ^5.4.19 | Build tool e dev server |
| **Linguagem** | TypeScript | ^5.8.3 | Tipagem estática |
| **Estilos** | Tailwind CSS | ^3.4.17 | Framework CSS utility-first |
| **Componentes** | shadcn/ui | — | Componentes acessíveis (Radix UI) |
| **Backend** | Supabase Edge Functions | — | Lógica de negócio (Deno runtime) |
| **Banco de Dados** | PostgreSQL (Supabase) | 15+ | Armazenamento relacional |
| **Autenticação** | Supabase Auth | — | JWT + email/senha |
| **Storage** | Supabase Storage | — | Armazenamento de arquivos (fotos) |

---

## Dependências de Produção

### Core

| Pacote | Versão | Uso |
|---|---|---|
| `react` | ^18.3.1 | Renderização de UI |
| `react-dom` | ^18.3.1 | DOM rendering |
| `react-router-dom` | ^6.30.1 | Roteamento SPA |
| `@supabase/supabase-js` | ^2.98.0 | Cliente Supabase (auth, DB, functions) |
| `@tanstack/react-query` | ^5.83.0 | Cache e gerenciamento de estado server-side |

### UI / Componentes

| Pacote | Versão | Uso |
|---|---|---|
| `@radix-ui/*` | Diversos | Primitivas UI acessíveis (dialog, select, tabs, etc.) |
| `class-variance-authority` | ^0.7.1 | Variantes de componentes |
| `clsx` | ^2.1.1 | Merge de classes condicionais |
| `tailwind-merge` | ^2.6.0 | Merge inteligente de classes Tailwind |
| `tailwindcss-animate` | ^1.0.7 | Animações Tailwind |
| `lucide-react` | ^0.462.0 | Ícones SVG |
| `cmdk` | ^1.1.1 | Command palette |
| `sonner` | ^1.7.4 | Toasts modernos |
| `vaul` | ^0.9.9 | Drawer mobile |
| `next-themes` | ^0.3.0 | Tema claro/escuro |
| `embla-carousel-react` | ^8.6.0 | Carousel |
| `react-resizable-panels` | ^2.1.9 | Painéis redimensionáveis |
| `input-otp` | ^1.4.2 | Input OTP |

### Formulários e Validação

| Pacote | Versão | Uso |
|---|---|---|
| `react-hook-form` | ^7.61.1 | Gerenciamento de formulários |
| `@hookform/resolvers` | ^3.10.0 | Resolvers de validação |
| `zod` | ^3.25.76 | Schema de validação |

### Gráficos e Datas

| Pacote | Versão | Uso |
|---|---|---|
| `recharts` | ^2.15.4 | Gráficos (BarChart, PieChart) |
| `date-fns` | ^3.6.0 | Manipulação de datas |
| `react-day-picker` | ^8.10.1 | Calendário/date picker |

### Reconhecimento Facial

| Pacote | Versão | Uso |
|---|---|---|
| `face-api.js` | ^0.22.2 | Detecção e reconhecimento facial |

Modelos utilizados (em `public/models/`):
- `tiny_face_detector_model` — Detecção rápida de faces
- `face_landmark_68_model` — 68 pontos de referência facial
- `face_recognition_model` — Descriptor de 128 dimensões

---

## Dependências de Desenvolvimento

| Pacote | Versão | Uso |
|---|---|---|
| `@vitejs/plugin-react-swc` | ^3.11.0 | Plugin React com SWC (compilação rápida) |
| `vitest` | ^3.2.4 | Framework de testes |
| `@testing-library/react` | ^16.0.0 | Testes de componentes React |
| `@testing-library/jest-dom` | ^6.6.0 | Matchers DOM para testes |
| `jsdom` | ^20.0.3 | DOM virtual para testes |
| `eslint` | ^9.32.0 | Linter |
| `typescript-eslint` | ^8.38.0 | Regras TypeScript para ESLint |
| `autoprefixer` | ^10.4.21 | Prefixos CSS automáticos |
| `postcss` | ^8.5.6 | Processador CSS |
| `lovable-tagger` | ^1.1.13 | Metadata de componentes Lovable |

---

## Arquitetura do Backend (Edge Functions)

| Função | Runtime | Auth | Descrição |
|---|---|---|---|
| `registrar-ponto` | Deno | JWT (verify_jwt=true) | Registro manual de ponto |
| `registrar-ponto-facial` | Deno | Bearer token manual | Registro facial de ponto |
| `gerenciar-entidades` | Deno | Bearer token + RBAC | CRUD centralizado (admin/gestor) |
| `gerenciar-configuracoes` | Deno | Bearer token + admin | Configurações do sistema |
| `calcular-banco-horas` | Deno | Bearer/cron | Cálculo de banco de horas |
| `verificar-ausencias` | Deno | Bearer/cron | Detecção de ausências |

### Padrão de segurança das Edge Functions:
1. Validar `Authorization` header
2. Validar JWT via Supabase Auth
3. Verificar role (admin/gestor) via `user_roles`
4. Sanitizar inputs (UUID, texto, e-mail, data, número)
5. Executar operação com `service_role_key`
6. Registrar auditoria em `audit_entidades`
7. Retornar JSON padronizado

---

## Banco de Dados

### Extensões
- `pgcrypto` — Hash SHA-256 para registros
- `pg_cron` — Agendamento de tarefas (cron jobs)
- `pg_net` — Chamadas HTTP de dentro do banco

### Segurança
- RLS habilitado em todas as tabelas
- Função `has_role()` com `SECURITY DEFINER` para verificação de roles
- Triggers de proteção em `registros_ponto` (imutabilidade + anti-exclusão)
- Hash SHA-256 em cada registro de ponto (NSR + user_id + data + entrada + timestamp)

### Sequências
- `nsr_seq` — Número Sequencial de Registro (NSR) para conformidade trabalhista

---

## Estrutura de Diretórios

```
├── docs/                          # Documentação
├── public/
│   ├── models/                    # Modelos face-api.js
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── ui/                    # Componentes shadcn/ui
│   │   ├── AppLayout.tsx          # Layout principal
│   │   ├── AppSidebar.tsx         # Sidebar de navegação
│   │   ├── ComprovanteCRPT.tsx    # Comprovante de ponto
│   │   ├── FaceRegistration.tsx   # Cadastro facial
│   │   └── ...
│   ├── hooks/
│   │   ├── useAuth.tsx            # Autenticação + roles
│   │   ├── useFaceApi.tsx         # Face-api.js
│   │   └── useTheme.tsx           # Tema claro/escuro
│   ├── integrations/supabase/     # Cliente e tipos auto-gerados
│   ├── lib/
│   │   ├── camera.ts             # Utilitários de câmera
│   │   ├── invokeEntityAction.ts  # Helper para Edge Functions
│   │   ├── registroPonto.ts       # Lógica de registro de ponto
│   │   └── utils.ts               # Utilitários gerais
│   ├── pages/                     # Páginas da aplicação
│   └── main.tsx                   # Entry point
├── supabase/
│   ├── functions/                 # Edge Functions (Deno)
│   ├── migrations/                # Migrações SQL
│   └── config.toml                # Configuração Supabase
├── .env                           # Variáveis de ambiente
├── tailwind.config.ts             # Configuração Tailwind
├── vite.config.ts                 # Configuração Vite
└── package.json
```

---

## Compatibilidade

| Requisito | Mínimo |
|---|---|
| Node.js | 18+ |
| Navegadores | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ |
| Câmera | WebRTC (getUserMedia) para reconhecimento facial |
| Geolocalização | API de Geolocalização do navegador |
| Resolução | Responsivo (320px - 1920px+) |
