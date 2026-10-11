---
name: adicionar-acao-entidades
description: Adiciona novas ações ao CRUD centralizado gerenciar-entidades. Use quando precisar criar um novo endpoint de entidade.
---

# Adicionar Ação ao gerenciar-entidades

O arquivo `supabase/functions/gerenciar-entidades/index.ts` é o CRUD centralizado.

## Onde Adicionar

Antes do `return jsonResponse({ success: false, error: "Invalid payload" }, 400);` no final do handler.

## Template

```typescript
if (action === "minha_acao") {
  requireAdmin(auth.isAdmin);  // ou requireAdminOrGestor()

  const id = sanitizeUUID(body.id, false);
  const nome = sanitizeText(body.nome, 120, true)!;
  const descricao = sanitizeText(body.descricao, 500, false);

  if (id) {
    const { data, error } = await auth.supabaseAdmin
      .from("tabela").update({ nome, descricao }).eq("id", id).select("*").single();
    if (error) throw error;

    await logAudit(auth.supabaseAdmin, auth.userId, "minha_acao_update", "tabela", id, { nome });
    return jsonResponse({ success: true, data });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("tabela").insert({ nome, descricao }).select("*").single();
  if (error) throw error;

  await logAudit(auth.supabaseAdmin, auth.userId, "minha_acao_create", "tabela", data.id, { nome });
  return jsonResponse({ success: true, data });
}
```

## Funções de Autorização

- `requireAdmin(auth.isAdmin)` → só admin
- `requireAdminOrGestor(auth.isAdmin, auth.isGestor)` → admin ou gestor
- Sem verificação → qualquer autenticado

## No Frontend

```typescript
const result = await invokeEntityAction("minha_acao", { nome: "Teste", descricao: "Desc" });
```
