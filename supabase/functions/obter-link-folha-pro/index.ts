import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: activeProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("active")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!activeProfile?.active) {
      return new Response(
        JSON.stringify({ success: false, error: "Conta desativada ou perfil ativo não encontrado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings, error: settingError } = await supabaseAdmin
      .from("configuracoes_sistema")
      .select("chave, valor")
      .in("chave", ["folha_pro_url", "folha_pro_visivel_gestores"]);

    if (settingError) throw settingError;

    const linkSetting = (settings || []).find((item) => item.chave === "folha_pro_url");
    const visibilitySetting = (settings || []).find((item) => item.chave === "folha_pro_visivel_gestores");
    const visibleForGestores = visibilitySetting ? visibilitySetting.valor === "true" : true;
    const candidate = String(linkSetting?.valor || "").trim();
    let url = "";
    if (candidate) {
      try {
        const parsedUrl = new URL(candidate);
        if (parsedUrl.protocol === "https:" && parsedUrl.hostname && !parsedUrl.username && !parsedUrl.password) {
          url = parsedUrl.toString();
        }
      } catch {
        // Malformed settings remain unset; the admin can correct them in the panel.
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: { url, visibleForGestores } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao obter link Folha Pro:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Não foi possível carregar o link do Folha Pro." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
