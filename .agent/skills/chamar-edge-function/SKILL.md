---
name: chamar-edge-function
description: Chama Edge Functions do Supabase a partir do frontend React. Use quando precisar integrar o frontend com lógica de backend.
---

# Chamar Edge Function no Frontend

O frontend usa `supabase.functions.invoke()` para chamar Edge Functions. Existe um helper centralizado em `src/lib/invokeEntityAction.ts`.

## Helper Principal

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

## Uso em Componentes

```typescript
// Criar cargo
const cargo = await invokeEntityAction("cargo_save", {
  nome: "Analista", descricao: "Desc", nivel: 3,
});

// Aprovar ocorrência
await invokeEntityAction("ocorrencia_decide", { id: "uuid", approved: true });
```

## Para Outras Edge Functions

```typescript
const { data, error } = await supabase.functions.invoke("registrar-ponto", {
  body: { action: "entrada", geo_latitude: -23.55, geo_longitude: -46.63 },
});
```

## Regras

- NUNCA usar `supabase.from("tabela").insert/update/delete()` para dados sensíveis
- Leituras (`SELECT`) são permitidas no frontend (protegidas por RLS)
- Sempre tratar erros e exibir toast/feedback ao usuário
- Usar `try/catch` com `toast.error()` para erros
