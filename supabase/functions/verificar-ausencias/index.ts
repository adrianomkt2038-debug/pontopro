import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get target date — defaults to today (UTC), or accept ?data=YYYY-MM-DD
    const url = new URL(req.url);
    const hoje = url.searchParams.get("data") || new Date().toISOString().split("T")[0];

    // Day of week: JS getDay() → 0=Sun … 6=Sat — DB stores 0=Sun or 1=Mon?
    // The escalas.dias_semana uses: 1=Mon … 5=Fri typically
    const dateObj = new Date(hoje + "T12:00:00Z");
    const jsDow = dateObj.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat

    // Fetch all active employees with their schedule
    const { data: funcionarios, error: funcErr } = await supabase
      .from("funcionarios")
      .select("user_id, escala_id, escalas(dias_semana)")
      .is("data_demissao", null);

    if (funcErr) throw funcErr;

    // Fetch active profiles
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("user_id, active, full_name")
      .eq("active", true);

    if (profErr) throw profErr;

    const activeUserIds = new Set((profiles || []).map((p: any) => p.user_id));

    // Fetch all registros_ponto for the date
    const { data: registros, error: regErr } = await supabase
      .from("registros_ponto")
      .select("user_id")
      .eq("data", hoje);

    if (regErr) throw regErr;

    const usersWithRegistro = new Set((registros || []).map((r: any) => r.user_id));

    // Fetch existing ocorrencias of type 'falta' for the date to avoid duplicates
    const { data: existingFaltas, error: faltaErr } = await supabase
      .from("ocorrencias")
      .select("user_id")
      .eq("data", hoje)
      .eq("tipo", "falta");

    if (faltaErr) throw faltaErr;

    const usersWithFalta = new Set((existingFaltas || []).map((o: any) => o.user_id));

    const ausentes: { user_id: string; data: string; tipo: string; descricao: string; status: string }[] = [];

    for (const func of funcionarios || []) {
      const userId = func.user_id;

      // Skip inactive users
      if (!activeUserIds.has(userId)) continue;

      // Skip users who already clocked in
      if (usersWithRegistro.has(userId)) continue;

      // Skip users who already have a falta ocorrencia
      if (usersWithFalta.has(userId)) continue;

      // Check if today is a workday for this employee
      const escala = func.escalas as any;
      if (escala && escala.dias_semana) {
        const diasSemana: number[] = escala.dias_semana;
        if (!diasSemana.includes(jsDow)) continue; // Not a workday
      } else {
        // No schedule linked — assume Mon-Fri (1-5)
        if (jsDow === 0 || jsDow === 6) continue;
      }

      ausentes.push({
        user_id: userId,
        data: hoje,
        tipo: "falta",
        descricao: "Ausência: nenhuma batida registrada durante a jornada de trabalho.",
        status: "pendente",
      });
    }

    // Also check active profiles WITHOUT a funcionario record (Mon-Fri default)
    const funcionarioUserIds = new Set((funcionarios || []).map((f: any) => f.user_id));
    for (const profile of profiles || []) {
      const userId = (profile as any).user_id;
      if (funcionarioUserIds.has(userId)) continue;
      if (usersWithRegistro.has(userId)) continue;
      if (usersWithFalta.has(userId)) continue;
      // Default Mon-Fri
      if (jsDow === 0 || jsDow === 6) continue;

      ausentes.push({
        user_id: userId,
        data: hoje,
        tipo: "falta",
        descricao: "Ausência: nenhuma batida registrada. Funcionário sem escala vinculada.",
        status: "pendente",
      });
    }

    if (ausentes.length > 0) {
      const { error: insertErr } = await supabase.from("ocorrencias").insert(ausentes);
      if (insertErr) throw insertErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          data: hoje,
          total_verificados: (profiles || []).length,
          ausentes_registrados: ausentes.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
