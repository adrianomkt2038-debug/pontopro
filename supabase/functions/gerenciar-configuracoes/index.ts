import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Check account state before using service-role privileges.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: activeProfile, error: activeProfileError } = await supabaseAdmin
      .from("profiles")
      .select("active")
      .eq("user_id", userId)
      .maybeSingle();
    if (activeProfileError) throw activeProfileError;
    if (!activeProfile?.active) {
      return new Response(JSON.stringify({ success: false, error: "Conta desativada ou perfil ativo não encontrado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role using service role client
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body to get action
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    // LIST - List all settings
    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("configuracoes_sistema")
        .select("*")
        .order("chave");

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE - Update a setting
    if (action === "update") {
      const { chave, valor } = body;

      if (!chave || valor === undefined || valor === null) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid payload: chave and valor are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existing } = await supabaseAdmin
        .from("configuracoes_sistema")
        .select("id, tipo, valor")
        .eq("chave", chave)
        .maybeSingle();

      if (!existing) {
        return new Response(
          JSON.stringify({ success: false, error: "Setting not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existing.tipo === "boolean" && !["true", "false"].includes(String(valor))) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid value for boolean setting" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existing.tipo === "number" && isNaN(Number(valor))) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid value for number setting" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existing.tipo === "select" && chave === "role_padrao_novos_usuarios") {
        const validRoles = ["admin", "gestor", "colaborador"];
        if (!validRoles.includes(String(valor))) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid role value" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const valorAnterior = existing.valor;

      const { error } = await supabaseAdmin
        .from("configuracoes_sistema")
        .update({ valor: String(valor) })
        .eq("chave", chave);

      if (error) throw error;

      // Log audit
      await supabaseAdmin.from("audit_configuracoes").insert({
        user_id: userId,
        chave,
        valor_anterior: valorAnterior,
        valor_novo: String(valor),
      });

      return new Response(
        JSON.stringify({ success: true, data: { chave, valor: String(valor) } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AUDIT - Get audit log
    if (action === "audit") {
      const { data, error } = await supabaseAdmin
        .from("audit_configuracoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const userIds = [...new Set((data || []).map((d: any) => d.user_id))];
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name; });

      const enriched = (data || []).map((d: any) => ({
        ...d,
        user_name: profileMap[d.user_id] || "Desconhecido",
      }));

      return new Response(
        JSON.stringify({ success: true, data: enriched }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CLEAR_AUDIT - Clear audit log
    if (action === "clear_audit") {
      const { error } = await supabaseAdmin
        .from("audit_configuracoes")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CLEAR_SESSOES - Clear sessoes_ponto
    if (action === "clear_sessoes") {
      const { error } = await supabaseAdmin
        .from("sessoes_ponto")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
