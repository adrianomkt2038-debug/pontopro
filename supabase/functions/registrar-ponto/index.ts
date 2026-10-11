import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getGeoInfo(ip: string) {
  try {
    const res = await fetch(`https://ipwho.is/${ip}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success === false) return null;
      return {
        city: data.city || null,
        countryCode: data.country_code || null,
        lat: data.latitude || null,
        lon: data.longitude || null,
      };
    }
  } catch { /* ignore */ }
  return null;
}

function parseOS(ua: string): string {
  if (/windows/i.test(ua)) return "Windows";
  if (/macintosh|mac os/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad/i.test(ua)) return "iOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Desconhecido";
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

function normalizeCoordinate(value: unknown, type: "lat" | "lon") {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  if (type === "lat" && (parsed < -90 || parsed > 90)) return null;
  if (type === "lon" && (parsed < -180 || parsed > 180)) return null;
  return Number(parsed.toFixed(6));
}

async function saveSession(supabase: any, params: {
  user_id: string; registro_ponto_id: string; acao: string;
  ip: string | null; userAgent: string | null;
  geoLatitude: number | null; geoLongitude: number | null;
}) {
  const geo = params.ip ? await getGeoInfo(params.ip) : null;
  const latitude = params.geoLatitude;
  const longitude = params.geoLongitude;

  await supabase.from("sessoes_ponto").insert({
    user_id: params.user_id,
    registro_ponto_id: params.registro_ponto_id,
    acao: params.acao,
    ip_address: params.ip,
    city: geo?.city || null,
    country_code: geo?.countryCode?.toLowerCase() || null,
    latitude,
    longitude,
    user_agent: params.userAgent,
    sistema_operacional: params.userAgent ? parseOS(params.userAgent) : null,
  });
}

serve(async (req) => {
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

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = { id: claimsData.claims.sub as string, email: (claimsData.claims as any).email || "" };

    const { data: activeProfile, error: activeProfileError } = await supabase
      .from("profiles")
      .select("active")
      .eq("user_id", user.id)
      .maybeSingle();
    if (activeProfileError) throw activeProfileError;
    if (!activeProfile?.active) {
      return new Response(JSON.stringify({ success: false, error: "Conta desativada ou perfil ativo não encontrado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action.trim() : "";
    const terminal_id = typeof body?.terminal_id === "string" ? body.terminal_id.trim() : "";
    const clientIp = body.client_ip || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = body.user_agent || req.headers.get("user-agent") || null;
    const geoLatitude = normalizeCoordinate(body?.geo_latitude, "lat");
    const geoLongitude = normalizeCoordinate(body?.geo_longitude, "lon");

    if (!action || !["entrada", "almoco_saida", "almoco_retorno", "saida"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid payload: action must be one of entrada, almoco_saida, almoco_retorno, saida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (geoLatitude === null || geoLongitude === null) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid payload: exact GPS coordinates are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    const today = getBusinessDate(new Date(now));

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, matricula")
      .eq("user_id", user.id)
      .single();

    const { data: existing, error: existingError } = await supabase
      .from("registros_ponto")
      .select("*")
      .eq("user_id", user.id)
      .eq("data", today)
      .maybeSingle();
    if (existingError) throw existingError;

    if (action === "entrada") {
      if (existing) {
        return new Response(
          JSON.stringify({ success: false, error: "Registro de entrada já existe para hoje" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data, error } = await supabase.from("registros_ponto").insert({
        user_id: user.id,
        data: today,
        entrada: now,
        status: "em_andamento",
        terminal_id: terminal_id || "web-app",
      }).select("*, nsr, hash_registro, horario_servidor, terminal_id").single();

      if (error?.code === "23505") {
        return new Response(JSON.stringify({ success: false, error: "Já existe um registro para hoje" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (error) throw error;

      // Save session info (non-blocking)
      saveSession(supabase, {
        user_id: user.id, registro_ponto_id: data.id,
        acao: "entrada", ip: clientIp, userAgent,
        geoLatitude, geoLongitude,
      }).catch(console.error);

      const crpt = {
        nsr: data.nsr, data: today, hora: now,
        funcionario: profile?.full_name || user.email,
        matricula: profile?.matricula || "N/A",
        terminal: data.terminal_id, acao: "Entrada", hash: data.hash_registro,
      };

      return new Response(
        JSON.stringify({ success: true, data, crpt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum registro encontrado para hoje. Registre a entrada primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existing.saida) {
      return new Response(JSON.stringify({ success: false, error: "A jornada já foi encerrada hoje" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (existing[action]) {
      return new Response(JSON.stringify({ success: false, error: "Esta batida já foi registrada hoje" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "almoco_saida" && !existing.entrada) {
      return new Response(JSON.stringify({ success: false, error: "Registre a entrada antes da saída para almoço" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "almoco_retorno" && (!existing.entrada || !existing.almoco_saida)) {
      return new Response(JSON.stringify({ success: false, error: "Registre a entrada e a saída para almoço antes do retorno" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "saida" && !existing.entrada) {
      return new Response(JSON.stringify({ success: false, error: "Registre a entrada antes da saída" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "saida" && existing.almoco_saida && !existing.almoco_retorno) {
      return new Response(JSON.stringify({ success: false, error: "Registre o retorno do almoço antes da saída" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updateData: Record<string, unknown> = { [action]: now };

    if (action === "saida") {
      updateData.status = "completo";
      if (existing.entrada) {
        const entradaTime = new Date(existing.entrada).getTime();
        const saidaTime = new Date(now).getTime();
        let workedMs = saidaTime - entradaTime;
        if (existing.almoco_saida && existing.almoco_retorno) {
          const lunchStart = new Date(existing.almoco_saida).getTime();
          const lunchEnd = new Date(existing.almoco_retorno).getTime();
          workedMs -= (lunchEnd - lunchStart);
        }
        const workedMinutes = Math.floor(workedMs / 60000);
        const expectedMinutes = 8 * 60;
        updateData.saldo_minutos = workedMinutes - expectedMinutes;
      }
    }

    let updateQuery = supabase
      .from("registros_ponto")
      .update(updateData)
      .eq("id", existing.id);
    // Optimistic lock over all punch columns avoids overwrites during concurrent requests.
    for (const column of ["entrada", "almoco_saida", "almoco_retorno", "saida"] as const) {
      const currentValue = existing[column];
      updateQuery = currentValue ? updateQuery.eq(column, currentValue) : updateQuery.is(column, null);
    }
    const { data, error } = await updateQuery
      .select("*, nsr, hash_registro, horario_servidor, terminal_id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return new Response(JSON.stringify({ success: false, error: "A batida mudou em outra solicitação. Atualize a tela e tente novamente." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save session info (non-blocking)
    saveSession(supabase, {
      user_id: user.id, registro_ponto_id: data.id,
      acao: action, ip: clientIp, userAgent,
      geoLatitude, geoLongitude,
    }).catch(console.error);

    const actionLabels: Record<string, string> = {
      almoco_saida: "Saída Almoço",
      almoco_retorno: "Retorno Almoço",
      saida: "Saída",
    };

    const crpt = {
      nsr: data.nsr, data: today, hora: now,
      funcionario: profile?.full_name || user.email,
      matricula: profile?.matricula || "N/A",
      terminal: data.terminal_id, acao: actionLabels[action] || action, hash: data.hash_registro,
    };

    return new Response(
      JSON.stringify({ success: true, data, crpt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("registrar-ponto error:", e);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
