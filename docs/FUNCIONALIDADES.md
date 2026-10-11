# 📋 Funcionalidades Completas — Controle de Ponto Pro

## Visão Geral

Sistema completo de controle de ponto eletrônico com reconhecimento facial, gestão de funcionários, banco de horas e auditoria. Desenvolvido em React + Supabase Edge Functions com arquitetura segura (toda lógica sensível no backend).

---

## 🔐 Autenticação e Autorização

### Login / Registro
- Login por e-mail e senha via Supabase Auth
- Registro de novos usuários com confirmação de e-mail
- Reset de senha via link enviado por e-mail (`/reset-password`)
- Primeiro usuário cadastrado recebe role `admin` automaticamente (trigger `handle_new_user`)

### Sistema de Roles (RBAC)
- **Roles:** `admin`, `gestor`, `colaborador`
- Roles armazenadas na tabela `user_roles` (separada de `profiles`)
- Verificação via função SQL `has_role(_user_id, _role)` (SECURITY DEFINER)
- Todas as operações sensíveis verificam roles no backend (Edge Functions)

---

## 📊 Dashboard (`/dashboard`)
- **Admin:** Total de usuários, presentes, ausentes, em andamento, justificativas/ocorrências pendentes, taxa de presença, saldo de horas
- **Colaborador:** Dados pessoais de ponto
- Gráfico de barras — presença/ausência dos últimos 7/15/30 dias
- Gráfico de pizza — distribuição de status (presentes, ausentes, em andamento)
- Filtro por período

---

## ⏱️ Registro de Ponto

### Ponto Manual (`/meu-ponto`)
- 4 batidas: Entrada → Saída Almoço → Retorno Almoço → Saída
- Validação sequencial de ações
- Geolocalização obrigatória (latitude/longitude do navegador)
- Sessão registrada com IP, User-Agent, OS, cidade/país
- Hash SHA-256 imutável por registro (NSR + user_id + data + entrada + horário_servidor)
- **Edge Function:** `registrar-ponto`

### Ponto Facial (`/registro-ponto`)
- Captura de foto via câmera do navegador
- Detecção facial com `face-api.js` (TinyFaceDetector + FaceLandmark68 + FaceRecognition)
- Comparação do descriptor facial contra todos os cadastrados
- Threshold de similaridade configurável
- Mesma lógica de 4 batidas + geolocalização
- **Edge Function:** `registrar-ponto-facial`

### Comprovante (CRPT)
- Gerado após cada batida com dados: nome, matrícula, data, horário, ação, NSR, hash
- Exibido em modal para conferência

---

## 👤 Cadastro Facial (`FaceRegistration`)
- Captura de foto do rosto via câmera
- Extração de descriptor facial (128 dimensões)
- Upload da foto para Storage (`face-photos` bucket)
- Armazenamento do descriptor na tabela `face_descriptors`
- Atualização do avatar no perfil
- **Edge Function:** `gerenciar-entidades` (ação `face_descriptor_upsert`)

---

## 👥 Gestão de Usuários (`/usuarios`)
- Listagem com pesquisa por nome/e-mail
- Edição: nome, role, status (ativo/inativo)
- Paginação
- Todas as operações via Edge Function `gerenciar-entidades` (ação `users_update`)

---

## 📝 Cadastro de Funcionário (`/cadastro-funcionario`)
- Criação de usuário completo: e-mail, senha, nome, matrícula
- Atribuição de cargo e escala
- Data de admissão
- **Edge Function:** `gerenciar-entidades` (ação `admin_create_funcionario`)

---

## 🏷️ Cargos (`/cargos`)
- CRUD completo: nome, descrição, nível
- **Edge Function:** `gerenciar-entidades` (ações `cargo_save`, `cargo_delete`)

---

## 📅 Escalas (`/escalas`)
- CRUD completo: nome, descrição, horários (entrada, saída, almoço início, almoço fim)
- Dias da semana (array numérico 0-6)
- Carga horária diária (intervalo)
- Tipo de registro associado
- **Edge Function:** `gerenciar-entidades` (ações `escala_save`, `escala_delete`)

---

## 📋 Tipos de Registro (`/tipos-registro`)
- CRUD: nome, descrição, batidas (array de strings)
- **Edge Function:** `gerenciar-entidades` (ações `tipo_registro_save`, `tipo_registro_delete`)

---

## 📄 Registros de Ponto (`/registros`)
- Listagem de todos os registros com filtros por data e usuário
- Visualização: entrada, saída almoço, retorno almoço, saída, status, NSR, hash
- Paginação

---

## 🏦 Banco de Horas (`/banco-horas`)
- Cálculo automático via trigger SQL `calcular_banco_horas_automatico` (ao completar registro)
- Cálculo manual via Edge Function `calcular-banco-horas`
- Tipos: `normal`, `hora_extra`, `jornada_incompleta`
- Tolerâncias configuráveis (`tolerancia_banco_horas`, `tolerancia_jornada_incompleta`)
- Visualização de saldo acumulado por funcionário
- Configurações de tolerância editáveis via Edge Function `gerenciar-entidades` (ação `configuracoes_ponto_update`)

---

## 📑 Justificativas (`/justificativas`)
- Criação: tipo, data, descrição, registro de ponto associado (opcional)
- Status: `pendente`, `aprovada`, `rejeitada`
- **Edge Function:** `gerenciar-entidades` (ação `justificativa_create`)

---

## ✅ Aprovações (`/aprovacoes`)
- Painel para admin/gestor aprovar/rejeitar ocorrências e justificativas
- **Edge Function:** `gerenciar-entidades` (ações `ocorrencia_decide`, `justificativa_decide`)

---

## 🚨 Alertas/Ocorrências (`/alertas`)
- Listagem de ocorrências pendentes
- Tipos: `falta`, `atraso`, `jornada_incompleta`, etc.
- Criação manual via Edge Function `gerenciar-entidades` (ação `ocorrencia_create`)

---

## 🔍 Verificação de Ausências
- Edge Function `verificar-ausencias` detecta funcionários sem registro no dia
- Cria ocorrências automáticas tipo `falta` com status `pendente`
- Considera dias da semana da escala do funcionário
- Ideal para execução via cron diário

---

## ⚙️ Configurações do Sistema (`/configuracoes`)
- Configurações gerenciadas via tabela `configuracoes_sistema`
- Parâmetros: auto-cadastro, role padrão, confirmação de e-mail, registro sem escala, tempo de sessão, notificações
- Auditoria de alterações na tabela `audit_configuracoes`
- **Edge Function:** `gerenciar-configuracoes`

---

## 📜 Histórico / Auditoria (`/historico`)
- **Aba "Ações do Sistema"**: log completo de todas as ações administrativas (tabela `audit_entidades`)
- **Aba "Sessões de Ponto"**: registros de sessão com IP, localização, dispositivo
- Paginação e possibilidade de limpar logs (admin)
- **Edge Function:** `gerenciar-entidades` (ações `audit_entidades_list`, `audit_entidades_clear`, `sessoes_list`)

---

## 👤 Perfil (`/perfil`)
- Visualização e edição do próprio perfil (nome)
- Upload/alteração de avatar
- Cadastro/atualização facial
- **Edge Function:** `gerenciar-entidades` (ação `profile_update_self`)

---

## 🎨 Interface
- Design responsivo com Tailwind CSS + shadcn/ui
- Tema claro/escuro (ThemeProvider)
- Sidebar colapsável com navegação contextual por role
- Toasts e notificações (Sonner + Radix Toast)

---

## 📦 Tabelas do Banco de Dados

| Tabela | Descrição |
|---|---|
| `profiles` | Dados do usuário (nome, e-mail, matrícula, avatar, ativo) |
| `user_roles` | Roles RBAC (admin, gestor, colaborador) |
| `funcionarios` | Vínculo funcionário ↔ cargo ↔ escala |
| `cargos` | Cargos disponíveis |
| `escalas` | Escalas de trabalho com horários e dias |
| `tipos_registro` | Tipos de registro de ponto |
| `registros_ponto` | Registros de ponto (4 batidas + status + hash + NSR) |
| `sessoes_ponto` | Metadados de sessão (IP, geo, UA) |
| `banco_horas` | Cálculo de horas trabalhadas vs esperadas |
| `ocorrencias` | Alertas e ocorrências (falta, atraso, jornada incompleta) |
| `justificativas` | Justificativas de ausência/atraso |
| `configuracoes_ponto` | Tolerâncias numéricas |
| `configuracoes_sistema` | Configurações gerais (booleano, número, select) |
| `audit_configuracoes` | Log de alterações em configurações |
| `audit_entidades` | Log de todas as ações administrativas |
| `face_descriptors` | Descriptors faciais (128 dimensões) |

---

## 🔧 Edge Functions

| Função | Descrição |
|---|---|
| `registrar-ponto` | Registro de ponto manual (autenticado) |
| `registrar-ponto-facial` | Registro de ponto via reconhecimento facial |
| `gerenciar-entidades` | CRUD centralizado de todas as entidades (admin/gestor) |
| `gerenciar-configuracoes` | CRUD de configurações do sistema (admin) |
| `calcular-banco-horas` | Cálculo manual de banco de horas |
| `verificar-ausencias` | Detecção automática de ausências |
