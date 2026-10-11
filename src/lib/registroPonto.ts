export type PontoAction = "entrada" | "almoco_saida" | "almoco_retorno" | "saida";

export interface PontoRegistro {
  entrada: string | null;
  almoco_saida: string | null;
  almoco_retorno: string | null;
  saida: string | null;
}

export function canRegisterPontoAction(action: PontoAction, registro: PontoRegistro | null | undefined) {
  if (!registro) return action === "entrada";

  // The daily record is immutable in sequence: once the final exit exists,
  // no additional action can be registered for that workday.
  if (registro.saida) return false;

  switch (action) {
    case "entrada":
      return false;
    case "almoco_saida":
      return !!registro.entrada && !registro.almoco_saida;
    case "almoco_retorno":
      return !!registro.entrada && !!registro.almoco_saida && !registro.almoco_retorno;
    case "saida":
      return !!registro.entrada && (!registro.almoco_saida || !!registro.almoco_retorno);
    default:
      return false;
  }
}

export async function getEdgeFunctionErrorMessage(error: unknown, fallback = "Falha ao registrar ponto") {
  const err = error as { message?: string; context?: unknown };
  const context = err?.context;

  if (context && typeof context === "object" && "json" in context) {
    const response = context as Response;

    try {
      const payload = (await response.clone().json()) as { error?: string; message?: string };
      if (payload?.error) return payload.error;
      if (payload?.message) return payload.message;
    } catch {
      try {
        const rawText = await response.clone().text();
        if (rawText) return rawText;
      } catch {
        // Ignore parsing fallback errors
      }
    }
  }

  if (err?.message && err.message.trim()) {
    return err.message;
  }

  return fallback;
}

export interface BrowserGeoPayload {
  geo_latitude?: number;
  geo_longitude?: number;
}

function normalizeCoordinate(value: unknown, type: "lat" | "lon") {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  if (type === "lat" && (parsed < -90 || parsed > 90)) return null;
  if (type === "lon" && (parsed < -180 || parsed > 180)) return null;
  return Number(parsed.toFixed(6));
}

export async function getBrowserGeoPayload(timeoutMs = 5000): Promise<BrowserGeoPayload> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return {};
  }

  return await new Promise((resolve) => {
    let finished = false;
    const finish = (payload: BrowserGeoPayload) => {
      if (finished) return;
      finished = true;
      resolve(payload);
    };

    const timer = window.setTimeout(() => finish({}), timeoutMs + 200);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer);

        const lat = normalizeCoordinate(position.coords.latitude, "lat");
        const lon = normalizeCoordinate(position.coords.longitude, "lon");

        if (lat == null || lon == null) {
          finish({});
          return;
        }

        finish({ geo_latitude: lat, geo_longitude: lon });
      },
      () => {
        window.clearTimeout(timer);
        finish({});
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
}

export async function getRequiredBrowserGeoPayload(timeoutMs = 5000) {
  const payload = await getBrowserGeoPayload(timeoutMs);

  if (payload.geo_latitude == null || payload.geo_longitude == null) {
    throw new Error("Não foi possível obter sua localização exata. Ative a permissão de localização do navegador e tente novamente.");
  }

  return payload as { geo_latitude: number; geo_longitude: number };
}
