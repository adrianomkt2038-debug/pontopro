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

/**
 * Converts the browser geolocation error code to an actionable message.
 * Code values follow the GeolocationPositionError web standard:
 * 1 = permission denied, 2 = position unavailable, 3 = timeout.
 */
export function getBrowserGeolocationErrorMessage(code: number | undefined) {
  switch (code) {
    case 1:
      return "O Chrome bloqueou a localização. No endereço do Ponto Pro, clique no ícone à esquerda do endereço > Configurações do site > Localização > Permitir. No Windows, ative também Configurações > Privacidade e segurança > Localização. Depois, recarregue a página.";
    case 2:
      return "O Chrome não conseguiu determinar sua posição. Ative os Serviços de localização do Windows, mantenha o Wi-Fi ligado e confira a conexão com a internet. Depois tente novamente.";
    case 3:
      return "A busca pela localização demorou demais. O Ponto Pro esperou 15 segundos sem receber coordenadas. Mantenha o Wi-Fi ligado, confira as permissões e tente novamente.";
    default:
      return "Não foi possível obter sua localização. Confira se o Chrome permite localização para o Ponto Pro e se os Serviços de localização do Windows estão ativados.";
  }
}

function requestBrowserGeoPayload(timeoutMs: number): Promise<BrowserGeoPayload> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new Error("Este navegador não disponibilizou a localização. Abra o Ponto Pro diretamente no Google Chrome usando o endereço seguro HTTPS.")
    );
  }

  return new Promise((resolve, reject) => {
    let finished = false;
    let timer = 0;

    const finish = (payload: BrowserGeoPayload) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      resolve(payload);
    };

    const fail = (message: string) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      reject(new Error(message));
    };

    // Keep a small buffer beyond the browser's own timeout so the native error
    // callback can usually provide the more precise reason first.
    timer = window.setTimeout(
      () => fail(getBrowserGeolocationErrorMessage(3)),
      timeoutMs + 1000
    );

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = normalizeCoordinate(position.coords.latitude, "lat");
          const lon = normalizeCoordinate(position.coords.longitude, "lon");

          if (lat == null || lon == null) {
            fail("O navegador retornou coordenadas inválidas. Confirme a localização do dispositivo e tente novamente.");
            return;
          }

          finish({ geo_latitude: lat, geo_longitude: lon });
        },
        (error) => fail(getBrowserGeolocationErrorMessage(error.code)),
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0,
        }
      );
    } catch {
      fail("O Chrome não conseguiu iniciar a localização. Confira as permissões do site e tente novamente.");
    }
  });
}

export async function getBrowserGeoPayload(timeoutMs = 15000): Promise<BrowserGeoPayload> {
  try {
    return await requestBrowserGeoPayload(timeoutMs);
  } catch {
    // Optional callers may continue without location. Point registration uses
    // getRequiredBrowserGeoPayload below and reports the actual cause.
    return {};
  }
}

export async function getRequiredBrowserGeoPayload(timeoutMs = 15000) {
  const payload = await requestBrowserGeoPayload(timeoutMs);

  if (payload.geo_latitude == null || payload.geo_longitude == null) {
    throw new Error("Não foi possível obter as coordenadas da sua localização. Confira as permissões do Chrome e tente novamente.");
  }

  return payload as { geo_latitude: number; geo_longitude: number };
}
