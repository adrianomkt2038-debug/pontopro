import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AppRole = "admin" | "gestor" | "colaborador";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_TIPOS_REGISTRO_BATIDAS = new Set([
  "entrada",
  "almoco_saida",
  "almoco_retorno",
  "saida",
  "intervalo_1_saida",
  "intervalo_1_retorno",
  "intervalo_2_saida",
  "intervalo_2_retorno",
]);

const ALLOWED_OCORRENCIA_TIPOS = new Set([
  "hora_extra",
  "banco_horas",
  "advertencia",
  "suspensao",
  "elogio",
  "outros",
  "jornada_incompleta",
]);

const ALLOWED_JUSTIFICATIVA_TIPOS = new Set([
  "falta",
  "atraso",
  "saida_antecipada",
  "atestado",
  "outros",
]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeText(value: unknown, maxLen: number, required = false): string | null {
  if (typeof value !== "string") {
    if (required) throw new Error("Invalid payload");
    return null;
  }
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (required && !cleaned) throw new Error("Invalid payload");
  if (!cleaned) return null;
  if (cleaned.length > maxLen) throw new Error("Invalid payload");
  return cleaned;
}

function sanitizeUUID(value: unknown, required = true): string | null {
  if (value === null || value === undefined || value === "") {
    if (required) throw new Error("Invalid payload");
    return null;
  }
  if (typeof value !== "string") throw new Error("Invalid payload");
  const cleaned = value.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned);
  if (!isUuid) throw new Error("Invalid payload");
  return cleaned;
}

function sanitizeDateISO(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid payload");
  const cleaned = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) throw new Error("Invalid payload");
  return cleaned;
}

function sanitizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid payload");
  const cleaned = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) || cleaned.length > 255) {
    throw new Error("Invalid payload");
  }
  return cleaned;
}

function validateStrongPassword(password: string) {
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(password);
  if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    throw new Error("Invalid payload");
  }
}

function sanitizeTime(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid payload");
  const cleaned = value.trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(cleaned)) throw new Error("Invalid payload");
  return cleaned.length === 5 ? `${cleaned}:00` : cleaned;
}

function sanitizeBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid payload");
  return value;
}

function sanitizeNumber(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid payload");
  const parsed = Math.floor(value);
  if (parsed < min || parsed > max) throw new Error("Invalid payload");
  return parsed;
}

function sanitizeRole(value: unknown): AppRole {
  if (value !== "admin" && value !== "gestor" && value !== "colaborador") {
    throw new Error("Invalid payload");
  }
  return value;
}

async function getAuthContext(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ success: false, error: "Unauthorized" }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return { error: jsonResponse({ success: false, error: "Internal error" }, 500) };
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);

  if (claimsError || !claimsData?.claims?.sub) {
    return { error: jsonResponse({ success: false, error: "Unauthorized" }, 401) };
  }

  const userId = claimsData.claims.sub as string;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: activeProfile, error: activeProfileError } = await supabaseAdmin
    .from("profiles")
    .select("active")
    .eq("user_id", userId)
    .maybeSingle();
  if (activeProfileError) {
    return { error: jsonResponse({ success: false, error: "Internal error" }, 500) };
  }
  if (!activeProfile?.active) {
    return { error: jsonResponse({ success: false, error: "Conta desativada ou perfil ativo não encontrado" }, 403) };
  }

  const { data: rolesData, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (rolesError) {
    return { error: jsonResponse({ success: false, error: "Internal error" }, 500) };
  }

  const roles = (rolesData || []).map((r) => r.role as AppRole);

  return {
    userId,
    roles,
    isAdmin: roles.includes("admin"),
    isGestor: roles.includes("gestor"),
    supabaseAdmin,
  };
}

function requireAdmin(isAdmin: boolean) {
  if (!isAdmin) {
    throw new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function requireAdminOrGestor(isAdmin: boolean, isGestor: boolean) {
  if (!isAdmin && !isGestor) {
    throw new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// Audit helper — fire-and-forget, never blocks the response
async function logAudit(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {}
) {
  try {
    await supabaseAdmin.from("audit_entidades").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await getAuthContext(req);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ success: false, error: "Invalid payload" }, 400);
    }

    const action = typeof body.action === "string" ? body.action : "";

    if (!action) {
      return jsonResponse({ success: false, error: "Invalid payload" }, 400);
    }

    // ========================
    // AUDIT LIST (ADMIN)
    // ========================
    if (action === "audit_entidades_list") {
      requireAdmin(auth.isAdmin);

      const { data, error } = await auth.supabaseAdmin
        .from("audit_entidades")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const items = data || [];
      const userIds = [...new Set(items.map((i: any) => i.user_id))];
      let profileMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await auth.supabaseAdmin
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.user_id] = p.full_name;
          }
        }
      }

      const enriched = items.map((i: any) => ({
        ...i,
        user_name: profileMap[i.user_id] || "Desconhecido",
      }));

      return jsonResponse({ success: true, data: enriched });
    }

    if (action === "audit_entidades_clear") {
      requireAdmin(auth.isAdmin);

      const { error } = await auth.supabaseAdmin
        .from("audit_entidades")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;
      return jsonResponse({ success: true, data: null });
    }

    // ========================
    // SESSOES LIST (ADMIN) — move reads to backend
    // ========================
    if (action === "sessoes_list") {
      requireAdmin(auth.isAdmin);

      const { data, error } = await auth.supabaseAdmin
        .from("sessoes_ponto")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const items = data || [];
      const userIds = [...new Set(items.map((s: any) => s.user_id))];
      let profileMap: Record<string, { full_name: string; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await auth.supabaseAdmin
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
          }
        }
      }

      const enriched = items.map((s: any) => ({
        ...s,
        profile: profileMap[s.user_id] || null,
      }));

      return jsonResponse({ success: true, data: enriched });
    }

    // ========================
    // USERS / ROLES / FUNCIONARIOS (ADMIN)
    // ========================
    if (action === "users_update") {
      requireAdmin(auth.isAdmin);

      const targetUserId = sanitizeUUID(body.target_user_id);
      const fullName = sanitizeText(body.full_name, 120, true)!;
      const matricula = sanitizeText(body.matricula, 40, false);
      const active = sanitizeBoolean(body.active);
      const role = sanitizeRole(body.role);
      const cargoId = sanitizeUUID(body.cargo_id, false);
      const escalaId = sanitizeUUID(body.escala_id, false);

      const { data: targetRoles, error: targetRolesError } = await auth.supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);

      if (targetRolesError) throw targetRolesError;

      const hadAdminRole = (targetRoles || []).some((r) => r.role === "admin");

      if (hadAdminRole && (role !== "admin" || !active)) {
        const { data: adminRoles, error: adminRolesError } = await auth.supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (adminRolesError) throw adminRolesError;

        const adminIds = [...new Set((adminRoles || []).map((r) => r.user_id))];
        if (adminIds.length <= 1) {
          return jsonResponse({ success: false, error: "Não é possível remover/desativar o último administrador." }, 400);
        }

        const { data: activeAdminProfiles, error: activeAdminProfilesError } = await auth.supabaseAdmin
          .from("profiles")
          .select("user_id")
          .in("user_id", adminIds)
          .eq("active", true);

        if (activeAdminProfilesError) throw activeAdminProfilesError;

        if ((activeAdminProfiles || []).length <= 1) {
          return jsonResponse({ success: false, error: "Não é possível remover/desativar o último administrador ativo." }, 400);
        }
      }

      const { error: profileError } = await auth.supabaseAdmin
        .from("profiles")
        .update({ full_name: fullName, matricula, active })
        .eq("user_id", targetUserId);

      if (profileError) throw profileError;

      const { error: deleteRolesError } = await auth.supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId);

      if (deleteRolesError) throw deleteRolesError;

      const { error: insertRoleError } = await auth.supabaseAdmin
        .from("user_roles")
        .insert({ user_id: targetUserId, role });

      if (insertRoleError) throw insertRoleError;

      const { data: existingFunc, error: existingFuncError } = await auth.supabaseAdmin
        .from("funcionarios")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existingFuncError) throw existingFuncError;

      const funcPayload = { cargo_id: cargoId, escala_id: escalaId };

      if (existingFunc?.id) {
        const { error: updateFuncError } = await auth.supabaseAdmin
          .from("funcionarios")
          .update(funcPayload)
          .eq("id", existingFunc.id);
        if (updateFuncError) throw updateFuncError;
      } else if (cargoId || escalaId) {
        const { error: insertFuncError } = await auth.supabaseAdmin
          .from("funcionarios")
          .insert({ user_id: targetUserId, ...funcPayload });
        if (insertFuncError) throw insertFuncError;
      }

      await logAudit(auth.supabaseAdmin, auth.userId, "users_update", "usuario", targetUserId, {
        full_name: fullName, role, active,
      });

      return jsonResponse({ success: true, data: { user_id: targetUserId } });
    }

    if (action === "admin_create_funcionario") {
      requireAdmin(auth.isAdmin);

      const fullName = sanitizeText(body.full_name, 120, true)!;
      const email = sanitizeEmail(body.email);
      const password = sanitizeText(body.password, 128, true)!;
      validateStrongPassword(password);

      const matricula = sanitizeText(body.matricula, 40, true)!;
      const cargoId = sanitizeUUID(body.cargo_id, false);
      const escalaId = sanitizeUUID(body.escala_id, false);
      const dataAdmissao = sanitizeDateISO(body.data_admissao);

      const { data: createdUser, error: createUserError } = await auth.supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { full_name: fullName },
      });

      if (createUserError || !createdUser.user) {
        return jsonResponse({ success: false, error: createUserError?.message || "Internal error" }, 400);
      }

      const newUserId = createdUser.user.id;

      const { data: existingProfile, error: existingProfileError } = await auth.supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("user_id", newUserId)
        .maybeSingle();

      if (existingProfileError) throw existingProfileError;

      if (existingProfile?.id) {
        const { error: profileUpdateError } = await auth.supabaseAdmin
          .from("profiles")
          .update({ full_name: fullName, email, matricula, active: true })
          .eq("id", existingProfile.id);
        if (profileUpdateError) throw profileUpdateError;
      } else {
        const { error: profileInsertError } = await auth.supabaseAdmin
          .from("profiles")
          .insert({ user_id: newUserId, full_name: fullName, email, matricula, active: true });
        if (profileInsertError) throw profileInsertError;
      }

      const funcionarioPayload: Record<string, unknown> = {
        user_id: newUserId,
        data_admissao: dataAdmissao,
      };

      if (cargoId) funcionarioPayload.cargo_id = cargoId;
      if (escalaId) funcionarioPayload.escala_id = escalaId;

      const { error: funcionarioError } = await auth.supabaseAdmin
        .from("funcionarios")
        .insert(funcionarioPayload as any);

      if (funcionarioError) throw funcionarioError;

      await logAudit(auth.supabaseAdmin, auth.userId, "admin_create_funcionario", "funcionario", newUserId, {
        full_name: fullName, email, matricula,
      });

      return jsonResponse({ success: true, data: { user_id: newUserId } });
    }

    if (action === "profile_update_self") {
      const fullName = sanitizeText(body.full_name, 120, true)!;

      const { error: profileError } = await auth.supabaseAdmin
        .from("profiles")
        .update({ full_name: fullName })
        .eq("user_id", auth.userId);

      if (profileError) throw profileError;

      await logAudit(auth.supabaseAdmin, auth.userId, "profile_update_self", "profile", auth.userId, {
        full_name: fullName,
      });

      return jsonResponse({ success: true, data: { user_id: auth.userId } });
    }

    // ========================
    // CARGOS (ADMIN)
    // ========================
    if (action === "cargo_save") {
      requireAdmin(auth.isAdmin);

      const id = sanitizeUUID(body.id, false);
      const nome = sanitizeText(body.nome, 120, true)!;
      const descricao = sanitizeText(body.descricao, 400, false);
      const nivel = sanitizeNumber(body.nivel, 1, 100);

      if (id) {
        const { data, error } = await auth.supabaseAdmin
          .from("cargos")
          .update({ nome, descricao, nivel })
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;

        await logAudit(auth.supabaseAdmin, auth.userId, "cargo_update", "cargo", id, { nome, nivel });
        return jsonResponse({ success: true, data });
      }

      const { data, error } = await auth.supabaseAdmin
        .from("cargos")
        .insert({ nome, descricao, nivel })
        .select("*")
        .single();
      if (error) throw error;

      await logAudit(auth.supabaseAdmin, auth.userId, "cargo_create", "cargo", data.id, { nome, nivel });
      return jsonResponse({ success: true, data });
    }

    if (action === "cargo_delete") {
      requireAdmin(auth.isAdmin);
      const id = sanitizeUUID(body.id);

      // Get name for audit before deleting
      const { data: existing } = await auth.supabaseAdmin.from("cargos").select("nome").eq("id", id).maybeSingle();

      const { error } = await auth.supabaseAdmin.from("cargos").delete().eq("id", id);
      if (error) throw error;

      await logAudit(auth.supabaseAdmin, auth.userId, "cargo_delete", "cargo", id, { nome: existing?.nome });
      return jsonResponse({ success: true, data: null });
    }

    // ========================
    // ESCALAS (ADMIN)
    // ========================
    if (action === "escala_save") {
      requireAdmin(auth.isAdmin);

      const id = sanitizeUUID(body.id, false);
      const nome = sanitizeText(body.nome, 120, true)!;
      const descricao = sanitizeText(body.descricao, 500, false);
      const horaEntrada = sanitizeTime(body.hora_entrada);
      const horaSaida = sanitizeTime(body.hora_saida);
      const horaAlmocoInicio = sanitizeTime(body.hora_almoco_inicio);
      const horaAlmocoFim = sanitizeTime(body.hora_almoco_fim);

      if (!Array.isArray(body.dias_semana) || body.dias_semana.length === 0) {
        return jsonResponse({ success: false, error: "Invalid payload" }, 400);
      }

      const diasSemana = [...new Set(body.dias_semana.map((d: unknown) => sanitizeNumber(d, 0, 6)))];
      const tipoRegistroId = sanitizeUUID(body.tipo_registro_id, false);

      const payload = {
        nome, descricao,
        hora_entrada: horaEntrada, hora_saida: horaSaida,
        hora_almoco_inicio: horaAlmocoInicio, hora_almoco_fim: horaAlmocoFim,
        dias_semana: diasSemana, tipo_registro_id: tipoRegistroId,
      };

      if (id) {
        const { data, error } = await auth.supabaseAdmin
          .from("escalas").update(payload).eq("id", id).select("*").single();
        if (error) throw error;

        await logAudit(auth.supabaseAdmin, auth.userId, "escala_update", "escala", id, { nome });
        return jsonResponse({ success: true, data });
      }

      const { data, error } = await auth.supabaseAdmin
        .from("escalas").insert(payload).select("*").single();
      if (error) throw error;

      await logAudit(auth.supabaseAdmin, auth.userId, "escala_create", "escala", data.id, { nome });
      return jsonResponse({ success: true, data });
    }

    if (action === "escala_delete") {
      requireAdmin(auth.isAdmin);
      const id = sanitizeUUID(body.id);

      const { data: existing } = await auth.supabaseAdmin.from("escalas").select("nome").eq("id", id).maybeSingle();

      const { error } = await auth.supabaseAdmin.from("escalas").delete().eq("id", id);
      if (error) throw error;

      await logAudit(auth.supabaseAdmin, auth.userId, "escala_delete", "escala", id, { nome: existing?.nome });
      return jsonResponse({ success: true, data: null });
    }

    // ========================
    // TIPOS DE REGISTRO (ADMIN)
    // ========================
    if (action === "tipo_registro_save") {
      requireAdmin(auth.isAdmin);

      const id = sanitizeUUID(body.id, false);
      const nome = sanitizeText(body.nome, 120, true)!;
      const descricao = sanitizeText(body.descricao, 300, false);

      if (!Array.isArray(body.batidas) || body.batidas.length === 0) {
        return jsonResponse({ success: false, error: "Invalid payload" }, 400);
      }

      const batidas = [...new Set(body.batidas.map((b: unknown) => sanitizeText(b, 50, true)!))];
      if (batidas.some((b) => !ALLOWED_TIPOS_REGISTRO_BATIDAS.has(b))) {
        return jsonResponse({ success: false, error: "Invalid payload" }, 400);
      }

      const payload = { nome, descricao, batidas };

      if (id) {
        const { data, error } = await auth.supabaseAdmin
          .from("tipos_registro").update(payload).eq("id", id).select("*").single();
        if (error) throw error;

        await logAudit(auth.supabaseAdmin, auth.userId, "tipo_registro_update", "tipo_registro", id, { nome });
        return jsonResponse({ success: true, data });
      }

      const { data, error } = await auth.supabaseAdmin
        .from("tipos_registro").insert(payload).select("*").single();
      if (error) throw error;

      await logAudit(auth.supabaseAdmin, auth.userId, "tipo_registro_create", "tipo_registro", data.id, { nome });
      return jsonResponse({ success: true, data });
    }

    if (action === "tipo_registro_delete") {
      requireAdmin(auth.isAdmin);
      const id = sanitizeUUID(body.id);

      const { data: existing } = await auth.supabaseAdmin.from("tipos_registro").select("nome").eq("id", id).maybeSingle();

      const { error } = await auth.supabaseAdmin.from("tipos_registro").delete().eq("id", id);
      if (error) throw error;

      await logAudit(auth.supabaseAdmin, auth.userId, "tipo_registro_delete", "tipo_registro", id, { nome: existing?.nome });
      return jsonResponse({ success: true, data: null });
    }

    // ========================
    // OCORRENCIAS
    // ========================
    if (action === "ocorrencia_create") {
      requireAdminOrGestor(auth.isAdmin, auth.isGestor);

      const targetUserId = sanitizeUUID(body.user_id);
      const tipo = sanitizeText(body.tipo, 80, true)!;
      const descricao = sanitizeText(body.descricao, 1500, true)!;
      const data = sanitizeDateISO(body.data);

      if (!ALLOWED_OCORRENCIA_TIPOS.has(tipo)) {
        return jsonResponse({ success: false, error: "Invalid payload" }, 400);
      }

      const { data: inserted, error } = await auth.supabaseAdmin
        .from("ocorrencias")
        .insert({ user_id: targetUserId, tipo, descricao, data })
        .select("*")
        .single();

      if (error) throw error;

      await logAudit(auth.supabaseAdmin, auth.userId, "ocorrencia_create", "ocorrencia", inserted.id, {
        tipo, target_user_id: targetUserId,
      });
      return jsonResponse({ success: true, data: inserted });
    }

    if (action === "ocorrencia_decide") {
      requireAdminOrGestor(auth.isAdmin, auth.isGestor);

      const id = sanitizeUUID(body.id);
      const approved = sanitizeBoolean(body.approved);

      const { data, error } = await auth.supabaseAdmin
        .from("ocorrencias")
        .update({ status: approved ? "aprovada" : "rejeitada", aprovado_por: auth.userId })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      await logAudit(auth.supabaseAdmin, auth.userId, approved ? "ocorrencia_approve" : "ocorrencia_reject", "ocorrencia", id, {});
      return jsonResponse({ success: true, data });
    }

    // ========================
    // JUSTIFICATIVAS
    // ========================
    if (action === "justificativa_create") {
      const requestedUserId = sanitizeUUID(body.user_id, false);
      const targetUserId = auth.isAdmin && requestedUserId ? requestedUserId : auth.userId;

      if (!auth.isAdmin && requestedUserId && requestedUserId !== auth.userId) {
        return jsonResponse({ success: false, error: "Forbidden" }, 403);
      }

      const data = sanitizeDateISO(body.data);
      const tipo = sanitizeText(body.tipo, 80, true)!;
      const descricao = sanitizeText(body.descricao, 1500, true)!;

      if (!ALLOWED_JUSTIFICATIVA_TIPOS.has(tipo)) {
        return jsonResponse({ success: false, error: "Invalid payload" }, 400);
      }

      const { data: inserted, error } = await auth.supabaseAdmin
        .from("justificativas")
        .insert({ user_id: targetUserId, data, tipo, descricao })
        .select("*")
        .single();

      if (error) throw error;

      await logAudit(auth.supabaseAdmin, auth.userId, "justificativa_create", "justificativa", inserted.id, {
        tipo, target_user_id: targetUserId,
      });
      return jsonResponse({ success: true, data: inserted });
    }

    if (action === "justificativa_decide") {
      requireAdmin(auth.isAdmin);

      const id = sanitizeUUID(body.id);
      const approved = sanitizeBoolean(body.approved);

      const { data, error } = await auth.supabaseAdmin
        .from("justificativas")
        .update({ status: approved ? "aprovada" : "rejeitada", aprovado_por: auth.userId })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      await logAudit(auth.supabaseAdmin, auth.userId, approved ? "justificativa_approve" : "justificativa_reject", "justificativa", id, {});
      return jsonResponse({ success: true, data });
    }

    // ========================
    // CONFIGURACOES PONTO (ADMIN)
    // ========================
    if (action === "configuracoes_ponto_update") {
      requireAdmin(auth.isAdmin);

      const toleranciaBancoHoras = sanitizeNumber(body.tolerancia_banco_horas, 0, 240);
      const toleranciaJornadaIncompleta = sanitizeNumber(body.tolerancia_jornada_incompleta, 0, 240);

      const { error: errorBh } = await auth.supabaseAdmin
        .from("configuracoes_ponto")
        .update({ valor: toleranciaBancoHoras })
        .eq("chave", "tolerancia_banco_horas");
      if (errorBh) throw errorBh;

      const { error: errorJi } = await auth.supabaseAdmin
        .from("configuracoes_ponto")
        .update({ valor: toleranciaJornadaIncompleta })
        .eq("chave", "tolerancia_jornada_incompleta");
      if (errorJi) throw errorJi;

      await logAudit(auth.supabaseAdmin, auth.userId, "configuracoes_ponto_update", "configuracoes_ponto", null, {
        tolerancia_banco_horas: toleranciaBancoHoras,
        tolerancia_jornada_incompleta: toleranciaJornadaIncompleta,
      });

      return jsonResponse({
        success: true,
        data: {
          tolerancia_banco_horas: toleranciaBancoHoras,
          tolerancia_jornada_incompleta: toleranciaJornadaIncompleta,
        },
      });
    }

    // ========================
    // FACE DESCRIPTOR / AVATAR
    // ========================
    if (action === "face_descriptor_upsert") {
      const targetUserId = sanitizeUUID(body.target_user_id);
      const avatarUrl = sanitizeText(body.avatar_url, 1500, false);
      const challengeId = sanitizeUUID(body.liveness_challenge_id);
      const proof = body.liveness_proof;
      const proofSteps = proof?.completedSteps;
      const proofDuration = proof?.durationMs;

      if (!auth.isAdmin && auth.userId !== targetUserId) {
        return jsonResponse({ success: false, error: "Forbidden" }, 403);
      }

      if (!Array.isArray(body.descriptor) || body.descriptor.length !== 128) {
        return jsonResponse({ success: false, error: "O descritor facial é inválido. Faça o cadastro novamente pela câmera." }, 400);
      }

      if (!challengeId || !Array.isArray(proofSteps) || proofSteps.length !== 3
        || !Number.isSafeInteger(proofDuration) || proofDuration < 4000 || proofDuration > 120000) {
        return jsonResponse({ success: false, error: "Prova de vida obrigatória. Faça o cadastro novamente pela câmera." }, 403);
      }

      const now = new Date().toISOString();
      const { data: challenge, error: challengeError } = await auth.supabaseAdmin
        .from("face_liveness_challenges")
        .select("id, challenge_steps")
        .eq("id", challengeId)
        .eq("user_id", targetUserId)
        .eq("purpose", "enrollment")
        .gt("expires_at", now)
        .is("consumed_at", null)
        .maybeSingle();
      if (challengeError) throw challengeError;

      const expectedSteps = challenge?.challenge_steps as string[] | undefined;
      if (!challenge || !expectedSteps || expectedSteps.length !== 3
        || !expectedSteps.every((step, index) => proofSteps[index] === step)
        || !["blink", "turn_left", "turn_right"].every((step) => expectedSteps.includes(step))) {
        return jsonResponse({ success: false, error: "Prova de vida inválida ou expirada. Tente novamente." }, 403);
      }

      const descriptor = body.descriptor.map((value: unknown) => {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new Error("Invalid payload");
        }
        return value;
      });

      // Reject a descriptor already associated with a different employee.
      const { data: otherFaces, error: otherFacesError } = await auth.supabaseAdmin
        .from("face_descriptors")
        .select("user_id, descriptor")
        .neq("user_id", targetUserId);
      if (otherFacesError) throw otherFacesError;

      for (const otherFace of otherFaces || []) {
        const otherDescriptor = otherFace.descriptor as number[];
        if (!Array.isArray(otherDescriptor) || otherDescriptor.length !== descriptor.length) continue;
        let sum = 0;
        for (let i = 0; i < descriptor.length; i++) {
          sum += Math.pow(descriptor[i] - otherDescriptor[i], 2);
        }
        if (Math.sqrt(sum) < 0.45) {
          return jsonResponse({
            success: false,
            error: "Este rosto parece já estar cadastrado para outro colaborador. Solicite revisão do administrador.",
          }, 409);
        }
      }

      const { data: consumedChallenge, error: consumeError } = await auth.supabaseAdmin
        .from("face_liveness_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", challengeId)
        .eq("user_id", targetUserId)
        .eq("purpose", "enrollment")
        .gt("expires_at", new Date().toISOString())
        .is("consumed_at", null)
        .select("id")
        .maybeSingle();
      if (consumeError) throw consumeError;
      if (!consumedChallenge) {
        return jsonResponse({ success: false, error: "Esta prova de vida já foi utilizada ou expirou. Recomece o cadastro." }, 409);
      }

      const { error: upsertError } = await auth.supabaseAdmin
        .from("face_descriptors")
        .upsert({ user_id: targetUserId, descriptor }, { onConflict: "user_id" });
      if (upsertError) throw upsertError;

      if (avatarUrl) {
        const { error: avatarUpdateError } = await auth.supabaseAdmin
          .from("profiles")
          .update({ avatar_url: avatarUrl })
          .eq("user_id", targetUserId);
        if (avatarUpdateError) throw avatarUpdateError;
      }

      await logAudit(auth.supabaseAdmin, auth.userId, "face_descriptor_upsert", "face_descriptor", targetUserId, {});
      return jsonResponse({ success: true, data: { user_id: targetUserId } });
    }

    return jsonResponse({ success: false, error: "Invalid payload" }, 400);
  } catch (err) {
    if (err instanceof Response) return err;

    const message = err instanceof Error ? err.message : "Internal error";

    if (message === "Invalid payload") {
      return jsonResponse({ success: false, error: "Invalid payload" }, 400);
    }

    console.error("gerenciar-entidades error:", err);
    return jsonResponse({ success: false, error: "Internal error" }, 500);
  }
});
