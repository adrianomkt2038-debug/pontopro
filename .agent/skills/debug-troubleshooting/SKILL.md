---
name: debug-troubleshooting
description: Guia de debugging e troubleshooting para problemas comuns do projeto. Use quando encontrar erros ou comportamentos inesperados.
---

# Debug e Troubleshooting

## Erros Comuns

### "Unauthorized" (401)
- Token JWT expirado ou ausente
- Verificar se `Authorization: Bearer <token>` está presente
- Verificar se o usuário está logado

### "Forbidden" (403)
- Usuário não tem a role necessária
- Verificar tabela `user_roles`

### "Invalid payload" (400)
- Dados não passaram na sanitização
- Verificar tipos e formatos enviados

### RLS bloqueando dados
- Verificar policies da tabela
- Testar com `has_role()` no SQL Editor
- Lembrar: limite padrão de 1000 rows por query

## Ferramentas de Debug

### Console do navegador
```typescript
// Verificar sessão
const { data } = await supabase.auth.getSession();
console.log(data.session?.user);
```

### Testar Edge Function
```typescript
const { data, error } = await supabase.functions.invoke("nome-funcao", {
  body: { action: "teste" },
});
console.log({ data, error });
```

### Verificar role no banco
```sql
SELECT ur.role, p.full_name, p.email
FROM user_roles ur
JOIN profiles p ON p.user_id = ur.user_id
WHERE ur.user_id = '<uuid>';
```

## Checklist de Debug

1. ✅ Console do navegador (erros JS)
2. ✅ Network tab (status HTTP, payload)
3. ✅ Logs da Edge Function (Supabase Dashboard)
4. ✅ RLS policies (SQL Editor)
5. ✅ Dados no banco (SQL Editor)
