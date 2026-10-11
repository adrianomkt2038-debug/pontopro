---
name: configurar-rls
description: Configura Row Level Security (RLS) no PostgreSQL. Use quando precisar proteger tabelas com políticas de acesso.
---

# Configurar RLS (Row Level Security)

## Padrão Obrigatório

Toda tabela com dados de usuário DEVE ter RLS habilitado.

## Template

```sql
ALTER TABLE public.nome_tabela ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário vê seus próprios dados
CREATE POLICY "Users read own data"
  ON public.nome_tabela FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin vê tudo
CREATE POLICY "Admins read all"
  ON public.nome_tabela FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Gestor vê tudo
CREATE POLICY "Gestors read all"
  ON public.nome_tabela FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));
```

## Função has_role

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

## Regras

- NUNCA usar `SECURITY DEFINER` em policies (apenas em funções)
- Usar `has_role()` para verificar permissões (evita recursão)
- Tabelas públicas (ex: `cargos`, `escalas`): SELECT para `authenticated`
- Escrita (INSERT/UPDATE/DELETE) sempre via Edge Function com `service_role_key`
