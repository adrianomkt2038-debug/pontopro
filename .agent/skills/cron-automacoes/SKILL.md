---
name: cron-automacoes
description: Configura cron jobs e automações com pg_cron. Use quando precisar agendar tarefas automáticas no banco de dados.
---

# Cron Jobs e Automações

## Verificar Ausências (diário)

```sql
SELECT cron.schedule(
  'verificar-ausencias-diario',
  '0 2 * * *',  -- 23:00 BRT (02:00 UTC)
  $$
  SELECT net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/verificar-ausencias',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := jsonb_build_object('data', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'))
  );
  $$
);
```

## Calcular Banco de Horas (diário)

```sql
SELECT cron.schedule(
  'calcular-banco-horas-diario',
  '30 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/calcular-banco-horas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := jsonb_build_object('data', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'))
  );
  $$
);
```

## Gerenciar

```sql
SELECT * FROM cron.job;                                          -- Listar
SELECT * FROM cron.job_run_details ORDER BY start_time DESC;     -- Histórico
SELECT cron.unschedule('nome-do-job');                           -- Remover
```

## Expressões Cron

| Expressão | Significado |
|---|---|
| `0 2 * * *` | Todo dia 02:00 UTC |
| `0 2 * * 1-5` | Seg-Sex 02:00 UTC |
| `*/30 * * * *` | A cada 30 min |
