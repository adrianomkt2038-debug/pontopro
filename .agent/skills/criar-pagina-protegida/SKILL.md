---
name: criar-pagina-protegida
description: Cria páginas autenticadas com ProtectedRoute e AppLayout. Use quando precisar adicionar uma nova página ao sistema.
---

# Criar Página Protegida

Todas as páginas autenticadas usam `ProtectedRoute` no `App.tsx` e herdam o `AppLayout` (sidebar + header).

## Passo a Passo

### 1. Criar a página em `src/pages/NomePagina.tsx`

```typescript
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function NomePagina() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tabela")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setData(data || []);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Título da Página</h1>
      <Card>
        <CardHeader><CardTitle>Conteúdo</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : <p>{data.length} registros</p>}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 2. Registrar rota em `src/App.tsx`

```typescript
import NomePagina from "./pages/NomePagina";

// Dentro de <Routes>:
<Route path="/nome-pagina" element={<ProtectedRoute><NomePagina /></ProtectedRoute>} />
```

### 3. Adicionar no sidebar `src/components/AppSidebar.tsx`

Adicionar o item de menu com ícone e rota.

## Hooks Disponíveis

- `useAuth()` → `{ user, loading, isAdmin, isGestor, role, signOut }`
- `useTheme()` → `{ theme, setTheme }`
- `useFaceApi()` → para reconhecimento facial

## Design System

- Usar tokens semânticos: `bg-background`, `text-foreground`, `bg-primary`, etc.
- NUNCA usar cores diretas (`bg-black`, `text-white`), sempre tokens
