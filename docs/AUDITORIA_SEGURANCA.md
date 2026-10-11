# 🔒 Auditoria de Segurança — Controle de Ponto Pro

**Data da auditoria:** 2026-03-06  
**Versão analisada:** Atual

---

## 1. Resumo Executivo

O sistema passou por refatoração completa de segurança para eliminar operações de escrita diretas no frontend. Toda lógica sensível agora reside em Supabase Edge Functions com validação de autenticação, autorização (RBAC) e sanitização de inputs.

| Categoria                 | Status          | Nota                                      |
| ------------------------- | --------------- | ----------------------------------------- |
| Autenticação              | ✅ Seguro       | JWT via Supabase Auth                     |
| Autorização (RBAC)        | ✅ Seguro       | Verificação server-side via `user_roles`  |
| Sanitização de Inputs     | ✅ Seguro       | Validação em todas as Edge Functions      |
| RLS (Row Level Security)  | ✅ Habilitado   | Todas as tabelas com RLS ativo            |
| Integridade de Dados      | ✅ Seguro       | Hash SHA-256 + triggers de imutabilidade  |
| Auditoria                 | ✅ Implementado | `audit_entidades` + `audit_configuracoes` |
| Frontend Write Operations | ✅ Eliminadas   | Todas migradas para Edge Functions        |

---

## 2. Autenticação

### ✅ Implementado

- Login por e-mail/senha via Supabase Auth
- JWT validado em todas as Edge Functions
- Token Bearer obrigatório em headers
- Reset de senha via link seguro
- Primeiro usuário recebe `admin` automaticamente (trigger DB)

---

## 3. Autorização (RBAC)

### ✅ Implementado

- Roles: `admin`, `gestor`, `colaborador` (enum `app_role`)
- Tabela separada `user_roles` (não no `profiles`)
- Função `has_role()` com `SECURITY DEFINER` (evita recursão RLS)
- Verificação de role em TODAS as Edge Functions antes de executar ações
- Segregação clara: admin-only vs admin/gestor vs colaborador

### Matriz de Permissões

| Ação                   | Admin | Gestor | Colaborador |
| ---------------------- | ----- | ------ | ----------- |
| CRUD Usuários          | ✅    | ❌     | ❌          |
| CRUD Cargos            | ✅    | ❌     | ❌          |
| CRUD Escalas           | ✅    | ✅     | ❌          |
| CRUD Tipos Registro    | ✅    | ❌     | ❌          |
| Criar Funcionário      | ✅    | ❌     | ❌          |
| Aprovar Ocorrências    | ✅    | ✅     | ❌          |
| Aprovar Justificativas | ✅    | ✅     | ❌          |
| Criar Ocorrência       | ✅    | ✅     | ❌          |
| Criar Justificativa    | ✅    | ✅     | ✅          |
| Registrar Ponto        | ✅    | ✅     | ✅          |
| Editar Próprio Perfil  | ✅    | ✅     | ✅          |
| Cadastro Facial        | ✅    | ✅     | ✅          |
| Ver Auditoria          | ✅    | ❌     | ❌          |
| Limpar Auditoria       | ✅    | ❌     | ❌          |
| Configurações Sistema  | ✅    | ❌     | ❌          |

---

## 4. Edge Functions — Análise

### `gerenciar-entidades` (CRUD centralizado)

| Verificação                        | Status                            |
| ---------------------------------- | --------------------------------- |
| Validação de Authorization header  | ✅                                |
| Validação de JWT (getClaims)       | ✅                                |
| Verificação de role (admin/gestor) | ✅                                |
| Sanitização de UUID                | ✅ (`sanitizeUUID`)               |
| Sanitização de texto               | ✅ (`sanitizeText` com maxLen)    |
| Sanitização de e-mail              | ✅ (`sanitizeEmail`)              |
| Sanitização de data                | ✅ (`sanitizeDateISO`)            |
| Sanitização de números             | ✅ (`sanitizeNumber` com min/max) |
| Sanitização de roles               | ✅ (`sanitizeRole`)               |
| Validação de senha forte           | ✅ (`validateStrongPassword`)     |
| Registro de auditoria              | ✅ (`logAudit` em todas as ações) |
| Uso de service_role_key            | ✅ (operações privilegiadas)      |

### `registrar-ponto` e `registrar-ponto-facial`

| Verificação                          | Status                                               |
| ------------------------------------ | ---------------------------------------------------- |
| Autenticação                         | ✅ JWT / Bearer token                                |
| Validação de ação sequencial         | ✅ (entrada → almoço_saída → almoço_retorno → saída) |
| Geolocalização obrigatória           | ✅                                                   |
| Normalização de coordenadas          | ✅                                                   |
| Registro de sessão (IP, UA, OS, geo) | ✅                                                   |
| Hash SHA-256 imutável                | ✅ (trigger DB)                                      |
| NSR sequencial                       | ✅ (trigger DB)                                      |

### `gerenciar-configuracoes`

| Verificação                | Status                       |
| -------------------------- | ---------------------------- |
| Autenticação               | ✅ JWT                       |
| Autorização admin-only     | ✅                           |
| Validação de tipo de valor | ✅ (boolean, number, select) |
| Auditoria de alterações    | ✅ (`audit_configuracoes`)   |

### `calcular-banco-horas` e `verificar-ausencias`

| Verificação                     | Status                                 |
| ------------------------------- | -------------------------------------- |
| Autenticação                    | ✅ (Bearer token ou cron com anon key) |
| Autorização admin (se não cron) | ✅                                     |
| `verify_jwt = false`            | ⚠️ Necessário para cron                |

---

## 5. Banco de Dados — Segurança

### RLS (Row Level Security)

| Tabela                  | RLS | Política                                  |
| ----------------------- | --- | ----------------------------------------- |
| `profiles`              | ✅  | Leitura por autenticados, escrita própria |
| `user_roles`            | ✅  | Somente via `has_role` (admin)            |
| `funcionarios`          | ✅  | Leitura por autenticados                  |
| `cargos`                | ✅  | Leitura por autenticados, escrita admin   |
| `escalas`               | ✅  | Leitura por autenticados, escrita admin   |
| `tipos_registro`        | ✅  | Leitura por autenticados, escrita admin   |
| `registros_ponto`       | ✅  | Leitura própria ou admin                  |
| `sessoes_ponto`         | ✅  | Leitura admin                             |
| `banco_horas`           | ✅  | Leitura própria ou admin                  |
| `ocorrencias`           | ✅  | Leitura própria ou admin                  |
| `justificativas`        | ✅  | Leitura própria ou admin                  |
| `configuracoes_ponto`   | ✅  | Leitura por autenticados                  |
| `configuracoes_sistema` | ✅  | Leitura por autenticados                  |
| `audit_configuracoes`   | ✅  | Admin only                                |
| `audit_entidades`       | ✅  | Admin only                                |
| `face_descriptors`      | ✅  | Leitura por autenticados                  |

### Triggers de Proteção

| Trigger                    | Tabela            | Função                                  |
| -------------------------- | ----------------- | --------------------------------------- |
| `trg_generate_nsr_hash`    | `registros_ponto` | Gera NSR + hash SHA-256                 |
| `trg_protect_registro`     | `registros_ponto` | Impede alteração de campos imutáveis    |
| `trg_prevent_delete`       | `registros_ponto` | Impede exclusão de registros            |
| `trg_calcular_banco_horas` | `registros_ponto` | Calcula banco de horas automaticamente  |
| `on_auth_user_created`     | `auth.users`      | Cria profile + role para novos usuários |

---

## 6. Frontend — Análise

### ✅ Conformidade com Regras

| Regra                                                          | Status |
| -------------------------------------------------------------- | ------ |
| Sem `supabase.from().insert()` para dados sensíveis            | ✅     |
| Sem `supabase.from().update()` para dados sensíveis            | ✅     |
| Sem `supabase.from().delete()`                                 | ✅     |
| Sem Node APIs (`process`, `fs`, `require`)                     | ✅     |
| Sem Express/Axios no backend                                   | ✅     |
| Toda lógica sensível em Edge Functions                         | ✅     |
| Frontend só faz leitura (`SELECT`) + chamada de Edge Functions | ✅     |

### Operações `SELECT` no Frontend (Baixo Risco)

Leituras diretas via `supabase.from().select()` são mantidas no frontend por serem protegidas por RLS. Tabelas acessadas:

- `profiles` (dados básicos)
- `registros_ponto` (próprios registros)
- `cargos`, `escalas`, `tipos_registro` (dados públicos de referência)
- `ocorrencias`, `justificativas` (dados próprios)
- `banco_horas` (dados próprios)
- `configuracoes_sistema`, `configuracoes_ponto` (leitura pública)

---

## 7. Armazenamento de Arquivos

### Storage Bucket `face-photos`

| Item                           | Status                                 |
| ------------------------------ | -------------------------------------- |
| Bucket público                 | ⚠️ Sim (fotos acessíveis publicamente) |
| Upload restrito a autenticados | ✅                                     |

---

## 8. Vulnerabilidades Conhecidas

### Risco Baixo

1. **Leituras frontend**: `SELECT` direto no frontend protegido por RLS — aceitável
2. **face-photos público**: Fotos acessíveis por URL direta — considerar bucket privado

### Risco Médio

3. **`verify_jwt = false` em 4 funções**: Necessário para cron, mas permite chamadas sem JWT — mitigado por verificação interna de token
4. **Sem rate limiting**: Tentativas ilimitadas de login/registro — considerar implementar

### Risco Alto

- **Nenhum identificado após a refatoração**

---

## 9. Conformidade Trabalhista (Portaria 671/MTE)

| Requisito                       | Status                                 |
| ------------------------------- | -------------------------------------- |
| NSR sequencial                  | ✅ (`nsr_seq`)                         |
| Hash criptográfico por registro | ✅ (SHA-256)                           |
| Imutabilidade de registros      | ✅ (triggers de proteção)              |
| Impossibilidade de exclusão     | ✅ (trigger `prevent_registro_delete`) |
| Horário do servidor registrado  | ✅ (`horario_servidor`)                |
| Comprovante de registro (CRPT)  | ✅ (modal com dados completos)         |

---

## 10. Checklist de Segurança

### ✅ Implementado

- [x] Autenticação JWT em todas as rotas protegidas
- [x] RBAC com verificação server-side
- [x] Sanitização de inputs em Edge Functions
- [x] RLS em todas as tabelas
- [x] Auditoria completa de ações administrativas
- [x] Hash SHA-256 em registros de ponto
- [x] Triggers de imutabilidade
- [x] Sem operações de escrita no frontend
- [x] Senhas fortes exigidas (8+ chars, maiúscula, minúscula, número, especial)

---

## 11. Conclusão

O sistema apresenta um nível de segurança **adequado** para uso em produção após a refatoração. Todas as vulnerabilidades críticas (operações de escrita no frontend, manipulação de roles client-side) foram eliminadas. As recomendações listadas são melhorias incrementais para hardening adicional.

**Classificação geral: 🟢 Seguro para produção**
