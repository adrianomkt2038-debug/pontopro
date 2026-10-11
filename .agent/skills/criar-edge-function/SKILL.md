---
name: criar-edge-function
description: Cria Edge Functions seguras com Deno runtime para o Supabase. Use quando precisar criar lógica de backend, APIs ou processamento seguro no servidor.
---

# Criar Edge Function Segura

Este projeto usa Supabase Edge Functions (Deno) para TODA lógica sensível. O frontend NUNCA faz INSERT/UPDATE/DELETE direto.

## Regras

1. Runtime: Deno (sem Node APIs: `process`, `fs`, `require`)
2. Sem Express, Axios, dependências Node
3. Imports via `https://esm.sh/` ou `https://deno.land/`
4. Toda função deve validar: Authorization header → JWT → Role → Payload

## Template

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 2. Validar JWT
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 3. Verificar role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Validar payload
    const body = await req.json();

    // 5. Executar lógica com supabaseAdmin

    return new Response(JSON.stringify({ success: true, data: {} }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

## Padrão de Resposta

- 200: `{ "success": true, "data": {} }`
- 400: `{ "success": false, "error": "Invalid payload" }`
- 401: `{ "success": false, "error": "Unauthorized" }`
- 403: `{ "success": false, "error": "Forbidden" }`
- 500: `{ "success": false, "error": "Internal error" }`
