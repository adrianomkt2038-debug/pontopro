import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBusinessDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isCron = token === serviceKey;

    // If not a cron call, validate user is admin
    if (!isCron) {
      if (!authHeader) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const userId = claimsData.claims.sub;
      const { data: activeProfile, error: activeProfileError } = await supabaseAdmin
        .from("profiles")
        .select("active")
        .eq("user_id", userId)
        .maybeSingle();
      if (activeProfileError) throw activeProfileError;
      if (!activeProfile?.active) return jsonResponse({ success: false, error: "Conta desativada ou perfil ativo não encontrado" }, 403);

      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    let targetDate: string;
    try {
      const body = await req.json();
      targetDate = body.data || getBusinessDate();
    } catch {
      targetDate = getBusinessDate();
    }

    // Get tolerance settings
    const { data: configs } = await supabaseAdmin
      .from("configuracoes_ponto")
      .select("chave, valor");

    const toleranciaBH = configs?.find((c: any) => c.chave === "tolerancia_banco_horas")?.valor ?? 10;
    const toleranciaJI = configs?.find((c: any) => c.chave === "tolerancia_jornada_incompleta")?.valor ?? 10;

    // Get all completed registros for the date
    const { data: registros } = await supabaseAdmin
      .from("registros_ponto")
      .select("id, user_id, data, entrada, almoco_saida, almoco_retorno, saida, status")
      .eq("data", targetDate)
      .eq("status", "completo");

    if (!registros || registros.length === 0) {
      return jsonResponse({ success: true, data: { processed: 0, message: "Nenhum registro completo encontrado" } });
    }

    // Get all funcionarios with their escalas
    const userIds = [...new Set(registros.map((r: any) => r.user_id))];
    const { data: funcionarios } = await supabaseAdmin
      .from("funcionarios")
      .select("user_id, escala_id, escalas(hora_entrada, hora_saida, hora_almoco_inicio, hora_almoco_fim, carga_horaria_diaria)")
      .in("user_id", userIds);

    let processed = 0;
    const results: any[] = [];

    for (const registro of registros) {
      const func = funcionarios?.find((f: any) => f.user_id === registro.user_id) as any;
      if (!func?.escalas) continue;

      const escala = func.escalas;

      // Calculate expected minutes from carga_horaria_diaria (interval format like "08:00:00")
      const cargaParts = escala.carga_horaria_diaria.split(":");
      const minutosEsperados = parseInt(cargaParts[0]) * 60 + parseInt(cargaParts[1]);

      // Calculate actual worked minutes
      if (!registro.entrada || !registro.saida) continue;

      const entrada = new Date(registro.entrada);
      const saida = new Date(registro.saida);
      let minutosTrabalhados = Math.round((saida.getTime() - entrada.getTime()) / 60000);

      // Subtract lunch break if both are recorded
      if (registro.almoco_saida && registro.almoco_retorno) {
        const almocoSaida = new Date(registro.almoco_saida);
        const almocoRetorno = new Date(registro.almoco_retorno);
        const almocoMinutos = Math.round((almocoRetorno.getTime() - almocoSaida.getTime()) / 60000);
        minutosTrabalhados -= almocoMinutos;
      }

      const diferenca = minutosTrabalhados - minutosEsperados;
      let tipo = "normal";
      let saldoFinal = 0;

      if (diferenca > toleranciaBH) {
        tipo = "hora_extra";
        saldoFinal = diferenca;
      } else if (diferenca < -toleranciaJI) {
        tipo = "jornada_incompleta";
        saldoFinal = diferenca;

        // Auto-create ocorrencia for incomplete journey
        const { data: existingOc } = await supabaseAdmin
          .from("ocorrencias")
          .select("id")
          .eq("user_id", registro.user_id)
          .eq("data", targetDate)
          .eq("tipo", "jornada_incompleta")
          .maybeSingle();

        if (!existingOc) {
          const hFalta = Math.floor(Math.abs(diferenca) / 60);
          const mFalta = Math.abs(diferenca) % 60;
          await supabaseAdmin.from("ocorrencias").insert({
            user_id: registro.user_id,
            data: targetDate,
            tipo: "jornada_incompleta",
            descricao: `Jornada incompleta: faltaram ${hFalta}h${mFalta.toString().padStart(2, "0")}min para completar a carga horária.`,
            status: "pendente",
          });
        }
      } else {
        saldoFinal = 0;
      }

      // Upsert banco_horas record
      const { data: existing } = await supabaseAdmin
        .from("banco_horas")
        .select("id")
        .eq("user_id", registro.user_id)
        .eq("data", targetDate)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin.from("banco_horas").update({
          minutos_trabalhados: minutosTrabalhados,
          minutos_esperados: minutosEsperados,
          saldo_minutos: saldoFinal,
          tipo,
          registro_ponto_id: registro.id,
        }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("banco_horas").insert({
          user_id: registro.user_id,
          registro_ponto_id: registro.id,
          data: targetDate,
          minutos_trabalhados: minutosTrabalhados,
          minutos_esperados: minutosEsperados,
          saldo_minutos: saldoFinal,
          tipo,
        });
      }

      processed++;
      results.push({
        user_id: registro.user_id,
        trabalhado: minutosTrabalhados,
        esperado: minutosEsperados,
        saldo: saldoFinal,
        tipo,
      });
    }

    return jsonResponse({ success: true, data: { processed, results } });
  } catch (err) {
    console.error(err);
    return jsonResponse({ success: false, error: "Internal error" }, 500);
  }
});
