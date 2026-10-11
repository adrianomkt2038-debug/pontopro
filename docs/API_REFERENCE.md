# 📡 Referência da API — Controle de Ponto Pro

Todas as Edge Functions seguem o padrão de resposta JSON padronizado.

---

## Padrão de Resposta

### Sucesso (200)
```json
{ "success": true, "data": { ... } }
```

### Erro de Validação (400)
```json
{ "success": false, "error": "Invalid payload" }
```

### Não Autenticado (401)
```json
{ "success": false, "error": "Unauthorized" }
```

### Não Autorizado (403)
```json
{ "success": false, "error": "Forbidden" }
```

### Erro Interno (500)
```json
{ "success": false, "error": "Internal error" }
```

---

## Headers Obrigatórios

| Header | Valor | Obrigatório |
|---|---|---|
| `Authorization` | `Bearer <JWT_TOKEN>` | Sim (exceto `registrar-ponto-facial`) |
| `Content-Type` | `application/json` | Sim |

---

## Base URL

```
https://<PROJECT_REF>.supabase.co/functions/v1/
```

---

# 1. `registrar-ponto`

> Registro de ponto manual (usuário autenticado).

**URL:** `POST /registrar-ponto`  
**Auth:** JWT (verify_jwt = true)  
**Permissão:** Qualquer usuário autenticado

### Payload

```json
{
  "action": "entrada | almoco_saida | almoco_retorno | saida",
  "terminal_id": "web-app",
  "client_ip": "189.1.2.3",
  "user_agent": "Mozilla/5.0 ...",
  "geo_latitude": -23.550520,
  "geo_longitude": -46.633308
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `action` | `string` | ✅ | Ação: `entrada`, `almoco_saida`, `almoco_retorno`, `saida` |
| `terminal_id` | `string` | ❌ | Identificador do terminal (default: `web-app`) |
| `client_ip` | `string` | ❌ | IP do cliente (fallback: `x-forwarded-for`) |
| `user_agent` | `string` | ❌ | User-Agent (fallback: header `user-agent`) |
| `geo_latitude` | `number` | ✅ | Latitude GPS (-90 a 90) |
| `geo_longitude` | `number` | ✅ | Longitude GPS (-180 a 180) |

### Resposta de Sucesso

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "data": "2026-03-06",
    "entrada": "2026-03-06T08:00:00.000Z",
    "almoco_saida": null,
    "almoco_retorno": null,
    "saida": null,
    "status": "em_andamento",
    "nsr": 42,
    "hash_registro": "a1b2c3...",
    "horario_servidor": "2026-03-06T08:00:01.000Z",
    "terminal_id": "web-app",
    "saldo_minutos": null
  },
  "crpt": {
    "nsr": 42,
    "data": "2026-03-06",
    "hora": "2026-03-06T08:00:00.000Z",
    "funcionario": "João Silva",
    "matricula": "MAT001",
    "terminal": "web-app",
    "acao": "Entrada",
    "hash": "a1b2c3..."
  }
}
```

### Erros Específicos

| Erro | HTTP | Condição |
|---|---|---|
| `Registro de entrada já existe para hoje` | 400 | Tentativa de entrada duplicada |
| `Nenhum registro encontrado para hoje. Registre a entrada primeiro.` | 400 | Ação sem entrada prévia |
| `Invalid payload: exact GPS coordinates are required` | 400 | Coordenadas ausentes |

### Regras de Negócio
- **Sequência obrigatória:** entrada → almoco_saida → almoco_retorno → saida
- **Ao registrar saída:** status muda para `completo`, `saldo_minutos` é calculado (trabalhado - 480min)
- **Sessão:** IP, geolocalização, OS e User-Agent são salvos em `sessoes_ponto` (non-blocking)

---

# 2. `registrar-ponto-facial`

> Registro de ponto via reconhecimento facial (sem autenticação JWT direta).

**URL:** `POST /registrar-ponto-facial`  
**Auth:** Sem verify_jwt (autenticação via `user_id` no payload)  
**Permissão:** Público (o frontend valida a face antes de chamar)

### Payload

```json
{
  "action": "entrada | almoco_saida | almoco_retorno | saida",
  "user_id": "uuid-do-usuario-reconhecido",
  "terminal_id": "facial-terminal",
  "client_ip": "189.1.2.3",
  "user_agent": "Mozilla/5.0 ...",
  "geo_latitude": -23.550520,
  "geo_longitude": -46.633308
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `action` | `string` | ✅ | Ação: `entrada`, `almoco_saida`, `almoco_retorno`, `saida` |
| `user_id` | `string (UUID)` | ✅ | ID do usuário reconhecido facialmente |
| `terminal_id` | `string` | ❌ | Identificador do terminal (default: `facial-terminal`) |
| `client_ip` | `string` | ❌ | IP do cliente |
| `user_agent` | `string` | ❌ | User-Agent |
| `geo_latitude` | `number` | ✅ | Latitude GPS |
| `geo_longitude` | `number` | ✅ | Longitude GPS |

### Resposta

Idêntica a `registrar-ponto`.

### Erros Adicionais

| Erro | HTTP | Condição |
|---|---|---|
| `User not found` | 404 | `user_id` não encontrado em `profiles` |
| `Saída Almoço já registrada para hoje` | 400 | Batida já realizada |
| `Registre a saída para almoço antes do retorno` | 400 | Sequência violada |
| `Registre o retorno do almoço antes da saída` | 400 | Saída sem retorno do almoço |

### Regras de Negócio
- Mesma lógica sequencial de `registrar-ponto`
- Validação extra: verifica se cada batida já foi registrada antes de permitir a próxima
- Calcula `saldo_minutos` na saída (trabalhado - 480min base)

---

# 3. `gerenciar-entidades`

> CRUD centralizado para todas as entidades administrativas.

**URL:** `POST /gerenciar-entidades`  
**Auth:** JWT (verify_jwt = true)  
**Permissão:** Varia por ação (admin / admin+gestor / autenticado)

### Payload Base

```json
{
  "action": "nome_da_acao",
  ...campos_específicos
}
```

---

## 3.1 Auditoria

### `audit_entidades_list`
**Permissão:** Admin  
**Payload:** `{ "action": "audit_entidades_list" }`

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "action": "cargo_create",
      "entity_type": "cargo",
      "entity_id": "uuid",
      "details": { "nome": "Desenvolvedor", "nivel": 3 },
      "created_at": "2026-03-06T10:00:00Z",
      "user_name": "Admin User"
    }
  ]
}
```

### `audit_entidades_clear`
**Permissão:** Admin  
**Payload:** `{ "action": "audit_entidades_clear" }`  
**Resposta:** `{ "success": true, "data": null }`

---

## 3.2 Sessões de Ponto

### `sessoes_list`
**Permissão:** Admin  
**Payload:** `{ "action": "sessoes_list" }`

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "registro_ponto_id": "uuid",
      "acao": "entrada",
      "ip_address": "189.1.2.3",
      "city": "São Paulo",
      "country_code": "br",
      "latitude": -23.5505,
      "longitude": -46.6333,
      "user_agent": "Mozilla/5.0 ...",
      "sistema_operacional": "Windows",
      "created_at": "2026-03-06T08:00:00Z",
      "profile": {
        "full_name": "João Silva",
        "avatar_url": "https://..."
      }
    }
  ]
}
```

---

## 3.3 Usuários

### `users_update`
**Permissão:** Admin

**Payload:**
```json
{
  "action": "users_update",
  "target_user_id": "uuid",
  "full_name": "João Silva",
  "matricula": "MAT001",
  "active": true,
  "role": "colaborador",
  "cargo_id": "uuid | null",
  "escala_id": "uuid | null"
}
```

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `target_user_id` | `UUID` | ✅ | UUID válido |
| `full_name` | `string` | ✅ | max 120 chars |
| `matricula` | `string` | ❌ | max 40 chars |
| `active` | `boolean` | ✅ | — |
| `role` | `string` | ✅ | `admin`, `gestor`, `colaborador` |
| `cargo_id` | `UUID | null` | ❌ | UUID válido ou null |
| `escala_id` | `UUID | null` | ❌ | UUID válido ou null |

**Proteção:** Impede remover/desativar o último administrador ativo.

**Resposta:** `{ "success": true, "data": { "user_id": "uuid" } }`

---

### `admin_create_funcionario`
**Permissão:** Admin

**Payload:**
```json
{
  "action": "admin_create_funcionario",
  "full_name": "Maria Souza",
  "email": "maria@empresa.com",
  "password": "Senha@Forte123",
  "matricula": "MAT002",
  "cargo_id": "uuid | null",
  "escala_id": "uuid | null",
  "data_admissao": "2026-03-06"
}
```

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `full_name` | `string` | ✅ | max 120 chars |
| `email` | `string` | ✅ | E-mail válido, max 255 chars |
| `password` | `string` | ✅ | 8+ chars, maiúscula, minúscula, número, especial |
| `matricula` | `string` | ✅ | max 40 chars |
| `cargo_id` | `UUID | null` | ❌ | UUID válido |
| `escala_id` | `UUID | null` | ❌ | UUID válido |
| `data_admissao` | `string` | ✅ | Formato `YYYY-MM-DD` |

**Resposta:** `{ "success": true, "data": { "user_id": "uuid" } }`

---

## 3.4 Perfil

### `profile_update_self`
**Permissão:** Qualquer autenticado (edita o próprio perfil)

**Payload:**
```json
{
  "action": "profile_update_self",
  "full_name": "João Silva Atualizado"
}
```

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `full_name` | `string` | ✅ | max 120 chars |

**Resposta:** `{ "success": true, "data": { "user_id": "uuid" } }`

---

## 3.5 Cargos

### `cargo_save`
**Permissão:** Admin

**Payload (criar):**
```json
{
  "action": "cargo_save",
  "nome": "Desenvolvedor",
  "descricao": "Desenvolvedor de software",
  "nivel": 3
}
```

**Payload (editar):**
```json
{
  "action": "cargo_save",
  "id": "uuid-existente",
  "nome": "Desenvolvedor Senior",
  "descricao": "Dev senior",
  "nivel": 5
}
```

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `id` | `UUID` | ❌ | Se presente, faz UPDATE; se ausente, INSERT |
| `nome` | `string` | ✅ | max 120 chars |
| `descricao` | `string` | ❌ | max 400 chars |
| `nivel` | `number` | ✅ | 1 a 100 |

**Resposta:** `{ "success": true, "data": { ...cargo_completo } }`

### `cargo_delete`
**Permissão:** Admin

**Payload:**
```json
{ "action": "cargo_delete", "id": "uuid" }
```

**Resposta:** `{ "success": true, "data": null }`

---

## 3.6 Escalas

### `escala_save`
**Permissão:** Admin

**Payload:**
```json
{
  "action": "escala_save",
  "id": "uuid (opcional, se edição)",
  "nome": "Comercial 8h",
  "descricao": "Horário comercial padrão",
  "hora_entrada": "08:00",
  "hora_saida": "17:00",
  "hora_almoco_inicio": "12:00",
  "hora_almoco_fim": "13:00",
  "dias_semana": [1, 2, 3, 4, 5],
  "tipo_registro_id": "uuid | null"
}
```

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `id` | `UUID` | ❌ | Se presente, UPDATE |
| `nome` | `string` | ✅ | max 120 chars |
| `descricao` | `string` | ❌ | max 500 chars |
| `hora_entrada` | `string` | ✅ | Formato `HH:MM` ou `HH:MM:SS` |
| `hora_saida` | `string` | ✅ | Formato `HH:MM` ou `HH:MM:SS` |
| `hora_almoco_inicio` | `string` | ✅ | Formato `HH:MM` ou `HH:MM:SS` |
| `hora_almoco_fim` | `string` | ✅ | Formato `HH:MM` ou `HH:MM:SS` |
| `dias_semana` | `number[]` | ✅ | Array de 0-6 (0=Dom, 1=Seg ... 6=Sáb) |
| `tipo_registro_id` | `UUID | null` | ❌ | UUID válido |

**Resposta:** `{ "success": true, "data": { ...escala_completa } }`

### `escala_delete`
**Permissão:** Admin  
**Payload:** `{ "action": "escala_delete", "id": "uuid" }`  
**Resposta:** `{ "success": true, "data": null }`

---

## 3.7 Tipos de Registro

### `tipo_registro_save`
**Permissão:** Admin

**Payload:**
```json
{
  "action": "tipo_registro_save",
  "id": "uuid (opcional)",
  "nome": "Padrão 4 batidas",
  "descricao": "Entrada, almoço saída/retorno, saída",
  "batidas": ["entrada", "almoco_saida", "almoco_retorno", "saida"]
}
```

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `id` | `UUID` | ❌ | Se presente, UPDATE |
| `nome` | `string` | ✅ | max 120 chars |
| `descricao` | `string` | ❌ | max 300 chars |
| `batidas` | `string[]` | ✅ | Valores permitidos: `entrada`, `almoco_saida`, `almoco_retorno`, `saida`, `intervalo_1_saida`, `intervalo_1_retorno`, `intervalo_2_saida`, `intervalo_2_retorno` |

**Resposta:** `{ "success": true, "data": { ...tipo_registro } }`

### `tipo_registro_delete`
**Permissão:** Admin  
**Payload:** `{ "action": "tipo_registro_delete", "id": "uuid" }`  
**Resposta:** `{ "success": true, "data": null }`

---

## 3.8 Ocorrências

### `ocorrencia_create`
**Permissão:** Admin ou Gestor

**Payload:**
```json
{
  "action": "ocorrencia_create",
  "user_id": "uuid-do-funcionario",
  "tipo": "advertencia",
  "descricao": "Atraso recorrente na última semana.",
  "data": "2026-03-06"
}
```

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `user_id` | `UUID` | ✅ | UUID do funcionário alvo |
| `tipo` | `string` | ✅ | `hora_extra`, `banco_horas`, `advertencia`, `suspensao`, `elogio`, `outros`, `jornada_incompleta` |
| `descricao` | `string` | ✅ | max 1500 chars |
| `data` | `string` | ✅ | Formato `YYYY-MM-DD` |

**Resposta:** `{ "success": true, "data": { ...ocorrencia } }`

### `ocorrencia_decide`
**Permissão:** Admin ou Gestor

**Payload:**
```json
{
  "action": "ocorrencia_decide",
  "id": "uuid-da-ocorrencia",
  "approved": true
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `UUID` | ✅ | ID da ocorrência |
| `approved` | `boolean` | ✅ | `true` = aprovada, `false` = rejeitada |

**Resposta:** `{ "success": true, "data": { ...ocorrencia_atualizada } }`

---

## 3.9 Justificativas

### `justificativa_create`
**Permissão:** Qualquer autenticado (para si mesmo) ou Admin (para outros)

**Payload:**
```json
{
  "action": "justificativa_create",
  "user_id": "uuid (opcional, admin pode especificar outro)",
  "data": "2026-03-05",
  "tipo": "atestado",
  "descricao": "Atestado médico de 1 dia."
}
```

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `user_id` | `UUID` | ❌ | Se ausente ou não-admin, usa o próprio user_id |
| `data` | `string` | ✅ | Formato `YYYY-MM-DD` |
| `tipo` | `string` | ✅ | `falta`, `atraso`, `saida_antecipada`, `atestado`, `outros` |
| `descricao` | `string` | ✅ | max 1500 chars |

**Resposta:** `{ "success": true, "data": { ...justificativa } }`

### `justificativa_decide`
**Permissão:** Admin

**Payload:**
```json
{
  "action": "justificativa_decide",
  "id": "uuid",
  "approved": true
}
```

**Resposta:** `{ "success": true, "data": { ...justificativa_atualizada } }`

---

## 3.10 Configurações de Ponto

### `configuracoes_ponto_update`
**Permissão:** Admin

**Payload:**
```json
{
  "action": "configuracoes_ponto_update",
  "tolerancia_banco_horas": 10,
  "tolerancia_jornada_incompleta": 15
}
```

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `tolerancia_banco_horas` | `number` | ✅ | 0 a 240 (minutos) |
| `tolerancia_jornada_incompleta` | `number` | ✅ | 0 a 240 (minutos) |

**Resposta:**
```json
{
  "success": true,
  "data": {
    "tolerancia_banco_horas": 10,
    "tolerancia_jornada_incompleta": 15
  }
}
```

---

## 3.11 Cadastro Facial

### `face_descriptor_upsert`
**Permissão:** Próprio usuário ou Admin

**Payload:**
```json
{
  "action": "face_descriptor_upsert",
  "target_user_id": "uuid",
  "descriptor": [0.123, -0.456, 0.789, ...],
  "avatar_url": "https://...supabase.co/storage/v1/object/public/face-photos/user-id.jpg"
}
```

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `target_user_id` | `UUID` | ✅ | Deve ser o próprio user ou admin editando |
| `descriptor` | `number[]` | ✅ | Array de 1 a 1024 floats |
| `avatar_url` | `string` | ❌ | max 1500 chars, URL da foto |

**Resposta:** `{ "success": true, "data": { "user_id": "uuid" } }`

---

# 4. `gerenciar-configuracoes`

> CRUD de configurações do sistema.

**URL:** `POST /gerenciar-configuracoes`  
**Auth:** Bearer token (verify_jwt = false, validação interna)  
**Permissão:** Admin

### 4.1 `list`

**Payload:** `{ "action": "list" }` ou `{}`

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "chave": "permitir_auto_cadastro",
      "valor": "true",
      "tipo": "boolean",
      "descricao": "Permitir que novos usuários se cadastrem"
    }
  ]
}
```

### 4.2 `update`

**Payload:**
```json
{
  "action": "update",
  "chave": "permitir_auto_cadastro",
  "valor": "false"
}
```

| Campo | Tipo | Validação |
|---|---|---|
| `chave` | `string` | Deve existir em `configuracoes_sistema` |
| `valor` | `string` | Validado por tipo: `boolean` → `"true"/"false"`, `number` → numérico, `select` (role) → `admin/gestor/colaborador` |

**Resposta:** `{ "success": true, "data": { "chave": "...", "valor": "..." } }`

### 4.3 `audit`

**Payload:** `{ "action": "audit" }`

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "chave": "permitir_auto_cadastro",
      "valor_anterior": "true",
      "valor_novo": "false",
      "created_at": "2026-03-06T10:00:00Z",
      "user_name": "Admin User"
    }
  ]
}
```

### 4.4 `clear_audit`

**Payload:** `{ "action": "clear_audit" }`  
**Resposta:** `{ "success": true, "data": null }`

### 4.5 `clear_sessoes`

**Payload:** `{ "action": "clear_sessoes" }`  
**Resposta:** `{ "success": true, "data": null }`

---

# 5. `calcular-banco-horas`

> Cálculo (ou recálculo) de banco de horas para uma data.

**URL:** `POST /calcular-banco-horas`  
**Auth:** Bearer token ou cron (verify_jwt = false)  
**Permissão:** Admin ou chamada cron (anon_key / service_role_key)

### Payload

```json
{
  "data": "2026-03-06"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data` | `string` | ❌ | Data alvo `YYYY-MM-DD`. Default: hoje |

### Resposta

```json
{
  "success": true,
  "data": {
    "processed": 5,
    "results": [
      {
        "user_id": "uuid",
        "trabalhado": 495,
        "esperado": 480,
        "saldo": 15,
        "tipo": "hora_extra"
      }
    ]
  }
}
```

### Lógica
1. Busca registros com status `completo` na data
2. Busca escala de cada funcionário para obter `carga_horaria_diaria`
3. Calcula minutos trabalhados (entrada→saída - almoço)
4. Aplica tolerâncias (`tolerancia_banco_horas`, `tolerancia_jornada_incompleta`)
5. Classifica: `normal`, `hora_extra` ou `jornada_incompleta`
6. Upsert em `banco_horas`
7. Cria ocorrência automática para jornada incompleta

---

# 6. `verificar-ausencias`

> Detecta funcionários sem registro de ponto no dia e cria ocorrências de falta.

**URL:** `POST /verificar-ausencias`  
**Auth:** Bearer token (verify_jwt = false)  
**Permissão:** Qualquer Bearer válido

### Payload

Via query string:
```
GET /verificar-ausencias?data=2026-03-06
```

Ou body JSON:
```json
{ "data": "2026-03-06" }
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data` | `string` | ❌ | Data alvo `YYYY-MM-DD`. Default: hoje |

### Resposta

```json
{
  "success": true,
  "data": {
    "data": "2026-03-06",
    "total_verificados": 25,
    "ausentes_registrados": 3
  }
}
```

### Lógica
1. Busca todos os funcionários ativos (sem `data_demissao`)
2. Busca perfis ativos
3. Busca registros de ponto do dia
4. Busca ocorrências `falta` existentes (evita duplicatas)
5. Para cada funcionário ativo sem registro:
   - Se tem escala: verifica se o dia da semana está nos `dias_semana`
   - Se não tem escala: assume Seg-Sex (1-5)
6. Cria ocorrências `falta` com status `pendente`

---

# Chamada pelo Frontend

Todas as chamadas do frontend para `gerenciar-entidades` passam pelo helper:

```typescript
import { supabase } from "@/integrations/supabase/client";

export async function invokeEntityAction<T>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("gerenciar-entidades", {
    body: { action, ...payload },
  });

  if (error || !data?.success) {
    throw new Error(data?.error || error?.message || "Operação negada");
  }

  return data.data as T;
}
```

### Exemplo de uso:

```typescript
// Criar cargo
const cargo = await invokeEntityAction("cargo_save", {
  nome: "Analista",
  descricao: "Analista de sistemas",
  nivel: 3,
});

// Aprovar ocorrência
await invokeEntityAction("ocorrencia_decide", {
  id: "uuid-da-ocorrencia",
  approved: true,
});

// Registrar ponto manual
const { data } = await supabase.functions.invoke("registrar-ponto", {
  body: {
    action: "entrada",
    geo_latitude: -23.5505,
    geo_longitude: -46.6333,
  },
});
```

---

# Mapa de Permissões Consolidado

| Ação | Admin | Gestor | Colaborador |
|---|---|---|---|
| `audit_entidades_list` | ✅ | ❌ | ❌ |
| `audit_entidades_clear` | ✅ | ❌ | ❌ |
| `sessoes_list` | ✅ | ❌ | ❌ |
| `users_update` | ✅ | ❌ | ❌ |
| `admin_create_funcionario` | ✅ | ❌ | ❌ |
| `profile_update_self` | ✅ | ✅ | ✅ |
| `cargo_save` | ✅ | ❌ | ❌ |
| `cargo_delete` | ✅ | ❌ | ❌ |
| `escala_save` | ✅ | ❌ | ❌ |
| `escala_delete` | ✅ | ❌ | ❌ |
| `tipo_registro_save` | ✅ | ❌ | ❌ |
| `tipo_registro_delete` | ✅ | ❌ | ❌ |
| `ocorrencia_create` | ✅ | ✅ | ❌ |
| `ocorrencia_decide` | ✅ | ✅ | ❌ |
| `justificativa_create` | ✅ | ✅ | ✅ (só própria) |
| `justificativa_decide` | ✅ | ❌ | ❌ |
| `configuracoes_ponto_update` | ✅ | ❌ | ❌ |
| `face_descriptor_upsert` | ✅ | ✅ (próprio) | ✅ (próprio) |
| `registrar-ponto` | ✅ | ✅ | ✅ |
| `registrar-ponto-facial` | público | público | público |
| `gerenciar-configuracoes` | ✅ | ❌ | ❌ |
| `calcular-banco-horas` | ✅ / cron | ❌ | ❌ |
| `verificar-ausencias` | cron | cron | cron |
