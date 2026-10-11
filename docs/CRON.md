# ⏰ Configuração de Cron Jobs — Controle de Ponto Pro

Este documento descreve os cron jobs necessários para automatizar tarefas recorrentes via Supabase.

---

## Visão Geral

| Cron Job | Edge Function | Frequência Recomendada | Descrição |
|---|---|---|---|
| Verificar Ausências | `verificar-ausencias` | Diário, 23:00 (UTC-3) | Detecta funcionários sem registro de ponto no dia |
| Calcular Banco de Horas | `calcular-banco-horas` | Diário, 23:30 (UTC-3) | Recalcula saldos de banco de horas (backup do trigger) |

> **Nota:** O cálculo de banco de horas já é feito automaticamente via trigger SQL (`calcular_banco_horas_automatico`). O cron serve como redundância para registros que possam ter falhado no trigger.

---

## Configuração no Supabase Dashboard

### 1. Verificar Ausências

No Supabase Dashboard → Database → Extensions → habilite `pg_cron` e `pg_net`.

```sql
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron: verificar ausências todo dia às 23:00 (02:00 UTC)
SELECT cron.schedule(
  'verificar-ausencias-diario',
  '0 2 * * *',  -- 23:00 BRT = 02:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://<SEU_PROJECT_REF>.supabase.co/functions/v1/verificar-ausencias',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUA_ANON_KEY>'
    ),
    body := jsonb_build_object('data', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'))
  );
  $$
);
```

### 2. Calcular Banco de Horas (Redundância)

```sql
-- Cron: calcular banco de horas todo dia às 23:30 (02:30 UTC)
SELECT cron.schedule(
  'calcular-banco-horas-diario',
  '30 2 * * *',  -- 23:30 BRT = 02:30 UTC
  $$
  SELECT net.http_post(
    url := 'https://<SEU_PROJECT_REF>.supabase.co/functions/v1/calcular-banco-horas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUA_ANON_KEY>'
    ),
    body := jsonb_build_object('data', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'))
  );
  $$
);
```

---

## Substituir Placeholders

Antes de executar, substitua:

| Placeholder | Onde encontrar |
|---|---|
| `<SEU_PROJECT_REF>` | Dashboard → Settings → General → Reference ID |
| `<SUA_ANON_KEY>` | Dashboard → Settings → API → `anon` `public` key |

---

## Gerenciar Cron Jobs

### Listar crons ativos

```sql
SELECT * FROM cron.job;
```

### Verificar execuções recentes

```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

### Desativar um cron

```sql
SELECT cron.unschedule('verificar-ausencias-diario');
SELECT cron.unschedule('calcular-banco-horas-diario');
```

### Alterar frequência

```sql
-- Exemplo: mudar para executar às 22:00 BRT (01:00 UTC)
SELECT cron.unschedule('verificar-ausencias-diario');
SELECT cron.schedule(
  'verificar-ausencias-diario',
  '0 1 * * *',
  $$ ... mesmo body ... $$
);
```

---

## Expressões Cron Úteis

| Expressão | Significado |
|---|---|
| `0 2 * * *` | Todo dia às 02:00 UTC (23:00 BRT) |
| `30 2 * * *` | Todo dia às 02:30 UTC (23:30 BRT) |
| `0 2 * * 1-5` | Seg-Sex às 02:00 UTC |
| `0 */6 * * *` | A cada 6 horas |
| `*/30 * * * *` | A cada 30 minutos |

---

## Monitoramento

Para verificar se os crons estão executando corretamente:

1. **Logs da Edge Function:**
   - Dashboard → Edge Functions → selecione a função → Logs

2. **Histórico do pg_cron:**
   ```sql
   SELECT jobid, jobname, status, return_message, start_time, end_time
   FROM cron.job_run_details
   WHERE jobname IN ('verificar-ausencias-diario', 'calcular-banco-horas-diario')
   ORDER BY start_time DESC
   LIMIT 10;
   ```

3. **Verificar resultados:**
   ```sql
   -- Ausências registradas hoje
   SELECT * FROM ocorrencias WHERE tipo = 'falta' AND data = CURRENT_DATE;
   
   -- Banco de horas calculado hoje
   SELECT * FROM banco_horas WHERE data = CURRENT_DATE;
   ```

---

## Troubleshooting

| Problema | Solução |
|---|---|
| Cron não executa | Verificar se `pg_cron` e `pg_net` estão habilitados |
| Erro 401 na Edge Function | Verificar se a anon key está correta e `verify_jwt = false` |
| Ausências não detectadas | Verificar se funcionários têm escala vinculada com dias corretos |
| Banco de horas zerado | Verificar se registros estão com status `completo` |
