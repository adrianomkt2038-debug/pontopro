const CAMERA_CONSTRAINTS: MediaStreamConstraints[] = [
  {
    video: {
      facingMode: { ideal: "user" },
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  },
  {
    video: { facingMode: "user" },
    audio: false,
  },
  {
    video: true,
    audio: false,
  },
];

const VIDEO_READY_TIMEOUT_MS = 2000;

function waitForVideoReady(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(cleanupAndResolve, VIDEO_READY_TIMEOUT_MS);

    function cleanupAndResolve() {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", cleanupAndResolve);
      video.removeEventListener("canplay", cleanupAndResolve);
      resolve();
    }

    video.addEventListener("loadedmetadata", cleanupAndResolve, { once: true });
    video.addEventListener("canplay", cleanupAndResolve, { once: true });
  });
}

export function isEmbeddedContext() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function requestUserCameraStream() {
  if (typeof window === "undefined") {
    throw new Error("CAMERA_UNAVAILABLE");
  }

  if (!window.isSecureContext) {
    throw new Error("INSECURE_CONTEXT");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("MEDIA_DEVICES_UNAVAILABLE");
  }

  let lastError: unknown = null;

  for (const constraints of CAMERA_CONSTRAINTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      console.warn("getUserMedia failed for constraints", constraints, error);
    }
  }

  throw lastError ?? new Error("CAMERA_REQUEST_FAILED");
}

export async function attachStreamToVideoElement(video: HTMLVideoElement, stream: MediaStream) {
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  video.srcObject = stream;

  await waitForVideoReady(video);

  try {
    await video.play();
  } catch (error) {
    const hasLiveVideoTrack = stream.getVideoTracks().some((track) => track.readyState === "live");

    if (!hasLiveVideoTrack) {
      throw error;
    }

    console.warn("video.play() failed but stream track is live", error);
  }
}

export function getCameraErrorMessage(error: unknown) {
  const err = error as DOMException | Error | null;
  const errorName = (err as DOMException | null)?.name;
  const errorMessage = (err as Error | null)?.message;

  if (errorMessage === "CAMERA_UNAVAILABLE") {
    return "A câmera não está disponível neste ambiente.";
  }

  if (errorMessage === "VIDEO_ELEMENT_UNAVAILABLE") {
    return "Falha ao iniciar a visualização da câmera. Tente novamente.";
  }

  if (errorMessage === "INSECURE_CONTEXT") {
    return "A câmera só funciona em conexão segura (HTTPS).";
  }

  if (errorMessage === "MEDIA_DEVICES_UNAVAILABLE") {
    return "Este navegador/dispositivo não suporta acesso à câmera.";
  }

  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return "Permissão da câmera negada. Libere nas configurações do navegador.";
  }

  if (errorName === "NotFoundError" || errorName === "OverconstrainedError") {
    return "Nenhuma câmera compatível foi encontrada neste dispositivo.";
  }

  if (errorName === "NotReadableError") {
    return "A câmera já está em uso por outro aplicativo.";
  }

  if (errorName === "AbortError") {
    return "A inicialização da câmera foi interrompida. Feche outros apps de câmera e tente novamente.";
  }

  if (errorName === "NotSupportedError") {
    return "Este navegador não permite captura de câmera neste contexto.";
  }

  return "Não foi possível abrir a câmera. Tente novamente.";
}

