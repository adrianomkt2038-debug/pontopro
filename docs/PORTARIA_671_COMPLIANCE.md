# Conformidade com a Portaria 671/2021 — Controle de Ponto Pro

Este documento descreve como o sistema atende aos requisitos legais da **Portaria 671/2021** do Ministério do Trabalho e Previdência, que regulamenta o registro eletrônico de jornada.

---

## 1. Integridade dos Dados

### Requisito Legal
O sistema de registro eletrônico de ponto **não pode permitir** edição, exclusão ou adulteração dos registros após a marcação.

### Implementação

| Mecanismo | Descrição |
|-----------|-----------|
| **Trigger `trg_prevent_delete`** | Trigger PostgreSQL na tabela `registros_ponto` que **bloqueia qualquer tentativa de DELETE**, garantindo que nenhum registro seja removido — nem por administradores. |
| **Trigger `trg_prevent_update`** | Trigger que **impede alteração dos campos críticos** (`entrada`, `saida`, `almoco_saida`, `almoco_retorno`, `data`, `user_id`, `hash_registro`, `nsr`) após a inserção. |
| **Hash SHA-256** | Cada registro recebe uma **assinatura digital** (campo `hash_registro`) gerada no momento da marcação, composta por: `user_id + data + horário + NSR`. Qualquer adulteração invalida o hash. |
| **Armazenamento mínimo de 5 anos** | Os registros são mantidos indefinidamente no banco de dados. A política de retenção garante no mínimo **5 anos** de armazenamento, conforme exigido pela legislação. Não existem rotinas de purga automática. |

### Fluxo de Proteção

```
Marcação → Edge Function (backend)
  ├── Gera hash SHA-256 (user_id + data + hora + NSR)
  ├── Insere registro com hash no banco
  └── Triggers impedem DELETE e UPDATE nos campos críticos
```

---

## 2. Registros Mínimos Obrigatórios

### Requisito Legal
Cada marcação de ponto deve conter, no mínimo:
- Data e hora exata (sincronizada com horário oficial brasileiro)
- Identificação do empregado
- Identificação do equipamento/terminal

### Implementação

| Campo | Coluna | Descrição |
|-------|--------|-----------|
| **Data** | `data` | Data da marcação (formato ISO `YYYY-MM-DD`) |
| **Hora** | `entrada`, `almoco_saida`, `almoco_retorno`, `saida` | Horário exato de cada batida (formato `HH:MM:SS`) |
| **Horário do servidor** | `horario_servidor` | Timestamp do servidor no momento da marcação, independente do relógio do cliente |
| **Identificação do empregado** | `user_id` | UUID do usuário autenticado via JWT |
| **Matrícula** | `profiles.matricula` | Número de matrícula único do funcionário |
| **Nome** | `profiles.full_name` | Nome completo do empregado |
| **Terminal** | `terminal_id` | Identificação do dispositivo/navegador utilizado |
| **IP** | `sessoes_ponto.ip_address` | Endereço IP do dispositivo |
| **User Agent** | `sessoes_ponto.user_agent` | Informações do navegador/sistema operacional |
| **Geolocalização** | `sessoes_ponto.latitude`, `longitude` | Coordenadas GPS (quando disponível) |

### Sincronização de Horário

O sistema utiliza o **horário do servidor** (campo `horario_servidor`) como referência oficial, garantindo que a marcação não dependa do relógio do dispositivo do empregado. O servidor está sincronizado via **NTP** com o horário oficial brasileiro.

---

## 3. Comprovante de Registro de Ponto do Trabalhador (CRPT)

### Requisito Legal
A cada marcação, o sistema deve emitir um **CRPT** contendo:
- NSR (Número Sequencial de Registro)
- Data da marcação
- Hora da marcação
- Identificação do empregado

### Implementação

O componente `ComprovanteCRPT` gera automaticamente o comprovante após cada batida, exibindo:

| Informação | Origem |
|------------|--------|
| **NSR** | Campo `nsr` do registro (sequencial, único, imutável) |
| **Data** | Campo `data` do registro |
| **Hora** | Campo correspondente à batida realizada |
| **Nome do empregado** | `profiles.full_name` |
| **Matrícula** | `profiles.matricula` |
| **Hash de verificação** | `hash_registro` (SHA-256) — permite auditoria |

### Formato do CRPT

```
╔══════════════════════════════════════════╗
║   COMPROVANTE DE REGISTRO DE PONTO      ║
║          DO TRABALHADOR (CRPT)          ║
╠══════════════════════════════════════════╣
║  NSR: 000147                            ║
║  Data: 06/03/2026                       ║
║  Hora: 08:00:12                         ║
║  Tipo: Entrada                          ║
║  Funcionário: João da Silva             ║
║  Matrícula: 001234                      ║
║  Hash: a3f8c2...b91d                    ║
╚══════════════════════════════════════════╝
```

O empregado pode visualizar e imprimir o comprovante a qualquer momento pelo sistema.

---

## 4. NSR — Número Sequencial de Registro

### Requisito Legal
- Cada batida deve ter um **NSR único, sequencial e imutável**
- **Não pode haver gaps** (saltos) na sequência
- A sequência deve ser contínua e auditável

### Implementação

| Mecanismo | Descrição |
|-----------|-----------|
| **Geração automática** | O NSR é gerado automaticamente pela Edge Function `registrar-ponto` no momento da inserção |
| **Sequência sem gaps** | Utiliza `SELECT COALESCE(MAX(nsr), 0) + 1` dentro de uma transação, garantindo sequencialidade |
| **Imutabilidade** | O campo `nsr` é protegido pelo trigger `trg_prevent_update` — não pode ser alterado após a inserção |
| **Unicidade** | Constraint `UNIQUE` no campo `nsr` impede duplicatas |
| **Auditoria** | Qualquer gap na sequência indica violação e pode ser detectado por consulta SQL simples |

### Verificação de Integridade do NSR

```sql
-- Detectar gaps na sequência de NSR
SELECT nsr + 1 AS gap_inicio
FROM registros_ponto r1
WHERE NOT EXISTS (
  SELECT 1 FROM registros_ponto r2
  WHERE r2.nsr = r1.nsr + 1
)
AND nsr < (SELECT MAX(nsr) FROM registros_ponto)
ORDER BY nsr;

-- Se retornar 0 linhas = sequência íntegra ✅
```

---

## 5. Sequência Lógica de Batidas

### Regra de Negócio
O registro de ponto segue uma **ordem obrigatória** que não pode ser violada:

```
1. Entrada → 2. Saída Almoço → 3. Retorno Almoço → 4. Saída
```

### Validação

- **Frontend**: Desabilita botões fora da sequência esperada
- **Backend (Edge Function)**: Valida a sequência antes de aceitar a marcação
- **Rejeição**: Retorna erro 400 se a batida estiver fora de ordem

| Batida anterior | Próxima permitida |
|-----------------|-------------------|
| Nenhuma | Entrada |
| Entrada | Saída Almoço |
| Saída Almoço | Retorno Almoço |
| Retorno Almoço | Saída |
| Saída | (dia completo) |

---

## 6. Reconhecimento Facial (Biometria)

### Implementação

O sistema oferece registro de ponto por **reconhecimento facial** como método de identificação biométrica:

| Componente | Descrição |
|------------|-----------|
| **face-api.js** | Biblioteca de detecção e reconhecimento facial |
| **`face_descriptors`** | Tabela que armazena os descritores faciais dos funcionários |
| **`face-photos`** | Bucket de storage para fotos de referência |
| **Threshold** | Distância euclidiana < 0.6 para validar identidade |

### Fluxo

```
Câmera → Detecção facial → Extração de descriptor
  → Comparação com descriptors cadastrados
  → Match encontrado → Registro de ponto automático
```

---

## 7. Auditoria e Rastreabilidade

### Tabelas de Auditoria

| Tabela | Finalidade |
|--------|-----------|
| `audit_entidades` | Registra todas as operações (CREATE, UPDATE, DELETE) em entidades do sistema |
| `audit_configuracoes` | Registra alterações nas configurações do sistema |
| `sessoes_ponto` | Registra metadados de cada sessão de registro (IP, localização, user agent) |

### Dados Auditados

- **Quem**: `user_id` do operador
- **Quando**: `created_at` com timestamp
- **O quê**: `action` + `entity_type` + `entity_id`
- **Detalhes**: JSON com valores anteriores e novos

---

## 8. Resumo de Conformidade

| Requisito | Status | Mecanismo |
|-----------|--------|-----------|
| Proibição de exclusão de registros | ✅ | Trigger `trg_prevent_delete` |
| Proibição de alteração de campos críticos | ✅ | Trigger `trg_prevent_update` |
| Hash/assinatura digital | ✅ | SHA-256 no campo `hash_registro` |
| Armazenamento mínimo 5 anos | ✅ | Sem rotina de purga |
| Data e hora sincronizadas (NTP) | ✅ | `horario_servidor` |
| Identificação do empregado | ✅ | `user_id`, `matricula`, `full_name` |
| Identificação do terminal | ✅ | `terminal_id`, `ip_address`, `user_agent` |
| Emissão de CRPT | ✅ | Componente `ComprovanteCRPT` |
| NSR sequencial e imutável | ✅ | Geração automática + trigger |
| NSR sem gaps | ✅ | Transação atômica + constraint UNIQUE |
| Sequência lógica de batidas | ✅ | Validação frontend + backend |
| Reconhecimento facial | ✅ | face-api.js + `face_descriptors` |
| Auditoria completa | ✅ | Tabelas `audit_*` + `sessoes_ponto` |
