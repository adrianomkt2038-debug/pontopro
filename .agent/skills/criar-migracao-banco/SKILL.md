---
name: criar-migracao-banco
description: Cria migrações SQL para o banco de dados PostgreSQL. Use quando precisar criar ou alterar tabelas, triggers, funções ou índices.
---

# Criar Migração de Banco de Dados

## Regras

1. NUNCA editar arquivos em `supabase/migrations/` diretamente
2. Usar a ferramenta de migração do Lovable/Supabase
3. NUNCA usar CHECK constraints com `now()` — usar triggers de validação
4. NUNCA modificar schemas reservados: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`
5. NUNCA usar `ALTER DATABASE postgres`

## Template de Criação de Tabela

```sql
CREATE TABLE IF NOT EXISTS public.nome_tabela (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON public.nome_tabela
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.nome_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem próprios dados"
  ON public.nome_tabela FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins veem tudo"
  ON public.nome_tabela FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

## Índices

```sql
CREATE INDEX IF NOT EXISTS idx_nome_tabela_user_id ON public.nome_tabela(user_id);
CREATE INDEX IF NOT EXISTS idx_nome_tabela_status ON public.nome_tabela(status);
```

## Convenções

- Tabelas: `snake_case`
- Sempre incluir `id`, `created_at`, `updated_at`
- Sempre habilitar RLS
- Usar `has_role()` para verificações de permissão em policies
