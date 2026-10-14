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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // This kiosk uses service-role database access, so require a valid admin session.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.slice("Bearer ".length);
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;
    const { data: callerProfile, error: callerProfileError } = await supabase
      .from("profiles")
      .select("active")
      .eq("user_id", callerId)
      .maybeSingle();
    if (callerProfileError) throw callerProfileError;
    if (!callerProfile?.active) {
      return new Response(JSON.stringify({ success: false, error: "Conta desativada ou perfil ativo não encontrado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;
    const isAdmin = !!adminRole;

    const body = await req.json();
    const intent = typeof body?.intent === "string" ? body.intent.trim() : "";
    const action = typeof body?.action === "string" ? body.action.trim() : "";
    const user_id = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const terminal_id = typeof body?.terminal_id === "string" ? body.terminal_id.trim() : "";
    const clientIp = body.client_ip || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = body.user_agent || req.headers.get("user-agent") || null;
    const geoLatitude = normalizeCoordinate(body?.geo_latitude, "lat");
    const geoLongitude = normalizeCoordinate(body?.geo_longitude, "lon");

    if (intent !== "liveness_challenge" && (!action || !["entrada", "almoco_saida", "almoco_retorno", "saida"].includes(action))) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid payload: action must be one of entrada, almoco_saida, almoco_retorno, saida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (intent !== "liveness_challenge" && (geoLatitude === null || geoLongitude === null)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid payload: exact GPS coordinates are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid payload: user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // A regular employee can register only their own point. The shared kiosk
    // may choose another employee only with an active administrator session.
    if (user_id !== callerId && !isAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Você só pode registrar o próprio ponto" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, full_name, matricula, active")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!profile.active) {
      return new Response(JSON.stringify({ success: false, error: "Não é possível registrar ponto para uma conta desativada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (intent === "liveness_challenge") {
      const purpose = body?.purpose === "enrollment" ? "enrollment" : body?.purpose === "clock_in" ? "clock_in" : null;
      if (!purpose) {
        return new Response(JSON.stringify({ success: false, error: "Finalidade da prova de vida inválida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const steps = ["blink", "turn_left", "turn_right"];
      for (let i = steps.length - 1; i > 0; i--) {
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        const j = random[0] % (i + 1);
        [steps[i], steps[j]] = [steps[j], steps[i]];
      }
      const recentWindow = new Date(Date.now() - 60_000).toISOString();
      const { count: recentChallenges, error: rateLimitError } = await supabase
        .from("face_liveness_challenges")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user_id)
        .gt("created_at", recentWindow);
      if (rateLimitError) throw rateLimitError;
      if ((recentChallenges ?? 0) >= 5) {
        return new Response(JSON.stringify({ success: false, error: "Muitas tentativas de prova de vida. Aguarde um minuto e tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expiresAt = new Date(Date.now() + 120000).toISOString();
      const { data: challenge, error: challengeError } = await supabase
        .from("face_liveness_challenges")
        .insert({ user_id, purpose, challenge_steps: steps, expires_at: expiresAt })
        .select("id, challenge_steps, expires_at")
        .single();
      if (challengeError) throw challengeError;

      return new Response(JSON.stringify({
        success: true,
        challenge: { id: challenge.id, steps: challenge.challenge_steps, expires_at: challenge.expires_at },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (intent) {
      return new Response(JSON.stringify({ success: false, error: "Intenção de solicitação inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    const challengeId = typeof body?.liveness_challenge_id === "string" ? body.liveness_challenge_id.trim() : "";
    const proof = body?.liveness_proof;
    const proofSteps = proof?.completedSteps;
    const proofDuration = proof?.durationMs;
    const validProof = Array.isArray(proofSteps)
      && Array.isArray(proof?.completedSteps)
      && proofSteps.length === 3
      && proofDuration >= 4000
      && proofDuration <= 120000
      && Number.isSafeInteger(proofDuration);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(challengeId) || !validProof) {
      return new Response(JSON.stringify({ success: false, error: "Prova de vida obrigatória. Inicie a verificação novamente." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: livenessChallenge, error: challengeLookupError } = await supabase
      .from("face_liveness_challenges")
      .select("id, challenge_steps, expires_at, consumed_at")
      .eq("id", challengeId)
      .eq("user_id", user_id)
      .eq("purpose", "clock_in")
      .gt("expires_at", now)
      .is("consumed_at", null)
      .maybeSingle();
    if (challengeLookupError) throw challengeLookupError;
    const expectedSteps = livenessChallenge?.challenge_steps as string[] | undefined;
    if (!livenessChallenge || !expectedSteps || expectedSteps.length !== 3
      || !expectedSteps.every((step, index) => proofSteps[index] === step)
      || !["blink", "turn_left", "turn_right"].every((step) => expectedSteps.includes(step))) {
      return new Response(JSON.stringify({ success: false, error: "Prova de vida inválida ou expirada. Tente novamente." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const liveDescriptor = body?.face_descriptor;
    if (!Array.isArray(liveDescriptor) || liveDescriptor.length !== 128
      || !liveDescriptor.every((value: unknown) => typeof value === "number" && Number.isFinite(value))) {
      return new Response(JSON.stringify({ success: false, error: "A imagem facial não pôde ser validada. Tente novamente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: registeredFace, error: faceError } = await supabase
      .from("face_descriptors")
      .select("descriptor")
      .eq("user_id", user_id)
      .maybeSingle();
    if (faceError) throw faceError;
    const storedDescriptor = registeredFace?.descriptor as number[] | undefined;
    if (!Array.isArray(storedDescriptor) || storedDescriptor.length !== liveDescriptor.length
      || !storedDescriptor.every((value) => typeof value === "number" && Number.isFinite(value))) {
      return new Response(JSON.stringify({ success: false, error: "Cadastro facial ausente ou inválido. Contate o RH." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let squaredDistance = 0;
    for (let i = 0; i < storedDescriptor.length; i++) {
      squaredDistance += Math.pow(liveDescriptor[i] - storedDescriptor[i], 2);
    }
    const serverDistance = Math.sqrt(squaredDistance);
    if (!Number.isFinite(serverDistance) || serverDistance >= 0.6) {
      return new Response(JSON.stringify({ success: false, error: "O rosto não corresponde ao cadastro facial." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const consumeLivenessChallenge = async () => {
      const { data: consumed, error: consumeError } = await supabase
        .from("face_liveness_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", challengeId)
        .eq("user_id", user_id)
        .eq("purpose", "clock_in")
        .gt("expires_at", new Date().toISOString())
        .is("consumed_at", null)
        .select("id")
        .maybeSingle();
      if (consumeError) throw consumeError;
      if (!consumed) throw new Error("Esta prova de vida já foi utilizada ou expirou. Inicie a verificação novamente.");
    };

    const today = getBusinessDate(new Date(now));

    const { data: existing, error: existingError } = await supabase
      .from("registros_ponto")
      .select("*")
      .eq("user_id", user_id)
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
      await consumeLivenessChallenge();
      const { data, error } = await supabase.from("registros_ponto").insert({
        user_id,
        data: today,
        entrada: now,
        status: "em_andamento",
        terminal_id: terminal_id || "facial-terminal",
      }).select("*, nsr, hash_registro, horario_servidor, terminal_id").single();

      if (error?.code === "23505") {
        return new Response(JSON.stringify({ success: false, error: "Já existe um registro para hoje" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (error) throw error;

      saveSession(supabase, {
        user_id, registro_ponto_id: data.id,
        acao: "entrada", ip: clientIp, userAgent,
        geoLatitude, geoLongitude,
      }).catch(console.error);

      const crpt = {
        nsr: data.nsr, data: today, hora: now,
        funcionario: profile.full_name,
        matricula: profile.matricula || "N/A",
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

    const actionLabels: Record<string, string> = {
      entrada: "Entrada",
      almoco_saida: "Saída Almoço",
      almoco_retorno: "Retorno Almoço",
      saida: "Saída",
    };

    if (existing.saida) {
      return new Response(JSON.stringify({ success: false, error: "A jornada já foi encerrada hoje" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((existing as Record<string, unknown>)[action]) {
      return new Response(
        JSON.stringify({ success: false, error: `${actionLabels[action]} já registrada para hoje` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "almoco_saida" && !existing.entrada) {
      return new Response(
        JSON.stringify({ success: false, error: "Registre a entrada antes da saída para almoço" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "almoco_retorno" && !existing.almoco_saida) {
      return new Response(
        JSON.stringify({ success: false, error: "Registre a saída para almoço antes do retorno" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "saida" && !existing.entrada) {
      return new Response(
        JSON.stringify({ success: false, error: "Registre a entrada antes da saída" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "saida" && existing.almoco_saida && !existing.almoco_retorno) {
      return new Response(
        JSON.stringify({ success: false, error: "Registre o retorno do almoço antes da saída" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updateData: Record<string, unknown> = { [action]: now };

    if (action === "saida") {
      updateData.status = "completo";
      if (existing.entrada) {
        const entradaTime = new Date(existing.entrada).getTime();
        const saidaTime = new Date(now).getTime();
        let workedMs = saidaTime - entradaTime;
        if (existing.almoco_saida && existing.almoco_retorno) {
          workedMs -= (new Date(existing.almoco_retorno).getTime() - new Date(existing.almoco_saida).getTime());
        }
        updateData.saldo_minutos = Math.floor(workedMs / 60000) - 480;
      }
    }

    await consumeLivenessChallenge();
    let updateQuery = supabase
      .from("registros_ponto")
      .update(updateData)
      .eq("id", existing.id);
    // Optimistic lock prevents concurrent punches from bypassing the sequence.
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

    saveSession(supabase, {
      user_id, registro_ponto_id: data.id,
      acao: action, ip: clientIp, userAgent,
      geoLatitude, geoLongitude,
    }).catch(console.error);

    const crpt = {
      nsr: data.nsr, data: today, hora: now,
      funcionario: profile.full_name,
      matricula: profile.matricula || "N/A",
      terminal: data.terminal_id, acao: actionLabels[action] || action, hash: data.hash_registro,
    };

    return new Response(
      JSON.stringify({ success: true, data, crpt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("registrar-ponto-facial error:", e);
    const message = e instanceof Error ? e.message : "Internal error";
    const isBusinessError =
      message.includes("não pode ser alterado") ||
      message.includes("já registrada") ||
      message.includes("Registre");

    return new Response(
      JSON.stringify({ success: false, error: isBusinessError ? message : "Internal error" }),
      { status: isBusinessError ? 400 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
