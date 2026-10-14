import * as faceapi from "face-api.js";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/registroPonto";

export type FaceLivenessStep = "blink" | "turn_left" | "turn_right";
export type FaceLivenessPurpose = "clock_in" | "enrollment";

export interface FaceLivenessChallenge {
  id: string;
  steps: FaceLivenessStep[];
  expiresAt: string;
  /** Client-side monotonic deadline; avoids workstation clock skew. */
  clientDeadline: number;
}

export interface FaceLivenessProof {
  completedSteps: FaceLivenessStep[];
  durationMs: number;
}

export interface FaceLivenessResult {
  descriptor: number[];
  proof: FaceLivenessProof;
}

type Point = { x: number; y: number };

const STEP_LABELS: Record<FaceLivenessStep, string> = {
  blink: "Pisque os olhos e depois abra-os",
  turn_left: "Vire a cabeça para um lado e volte ao centro",
  turn_right: "Vire a cabeça para o lado oposto e volte ao centro",
};

const ALL_STEPS: FaceLivenessStep[] = ["blink", "turn_left", "turn_right"];
const DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  // Match the main scanner's input scale while keeping a practical confidence threshold.
  inputSize: 416,
  scoreThreshold: 0.35,
});

export function getLivenessStepLabel(step: FaceLivenessStep): string {
  return STEP_LABELS[step];
}

export function isFaceLivenessChallengeExpired(challenge: Pick<FaceLivenessChallenge, "expiresAt" | "clientDeadline">): boolean {
  if (Number.isFinite(challenge.clientDeadline)) {
    return performance.now() >= challenge.clientDeadline;
  }
  const serverExpiry = Date.parse(challenge.expiresAt);
  return !Number.isFinite(serverExpiry) || Date.now() >= serverExpiry;
}

export function isValidLivenessSteps(steps: unknown): steps is FaceLivenessStep[] {
  if (!Array.isArray(steps) || steps.length !== ALL_STEPS.length) return false;
  return ALL_STEPS.every((step) => steps.includes(step)) && new Set(steps).size === ALL_STEPS.length;
}

export function areLivenessStepsComplete(expected: readonly FaceLivenessStep[], actual: unknown): boolean {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((step, index) => step === expected[index])
    && isValidLivenessSteps(expected);
}

export function isPlausibleLivenessDuration(durationMs: unknown): durationMs is number {
  return typeof durationMs === "number"
    && Number.isSafeInteger(durationMs)
    && durationMs >= 4000
    && durationMs <= 120000;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function calculateEyeAspectRatio(points: readonly Point[]): number {
  if (points.length !== 6) return 0;
  const verticalA = distance(points[1], points[5]);
  const verticalB = distance(points[2], points[4]);
  const horizontal = distance(points[0], points[3]);
  if (!Number.isFinite(horizontal) || horizontal <= 0) return 0;
  return (verticalA + verticalB) / (2 * horizontal);
}

/**
 * Blink thresholds are relative to each person's open-eye baseline. Absolute
 * cutoffs fail for naturally narrow eyes and can make reopening impossible.
 */
export function calculateBlinkThresholds(baselineOpenEar: number) {
  if (!Number.isFinite(baselineOpenEar) || baselineOpenEar <= 0) {
    return { closed: 0, reopened: 0 };
  }
  return {
    closed: baselineOpenEar * 0.70,
    reopened: baselineOpenEar * 0.88,
  };
}

export type HeadTurnDirection = -1 | 1;

export function calculateHeadTurnThresholds(baselineYawSamples: readonly number[]) {
  const finite = baselineYawSamples.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (finite.length < 3) return { movement: 0.05, center: 0.03 };

  const baseline = finite[Math.floor(finite.length / 2)];
  const deviations = finite.map((value) => Math.abs(value - baseline)).sort((a, b) => a - b);
  const medianNoise = deviations[Math.floor(deviations.length / 2)];
  const center = Math.min(0.06, Math.max(0.03, medianNoise * 2));
  return { movement: Math.min(0.08, center + 0.02), center };
}

export type HeadTurnDirection = -1 | 1;

export function getHeadTurnDirection(yawDelta: number, movementThreshold = 0.05): HeadTurnDirection | null {
  if (!Number.isFinite(yawDelta)) return null;
  if (yawDelta < -movementThreshold) return -1;
  if (yawDelta > movementThreshold) return 1;
  return null;
}

/** The first turn can be either direction; the second must reverse it. */
export function isHeadTurnDetected(
  yawDelta: number,
  firstDirection: HeadTurnDirection | null,
  movementThreshold = 0.05,
): boolean {
  const direction = getHeadTurnDirection(yawDelta, movementThreshold);
  return direction !== null && (firstDirection === null || direction === -firstDirection);
}

export function isHeadBackAtCenter(yawDelta: number, centerTolerance = 0.03): boolean {
  return Number.isFinite(yawDelta) && Math.abs(yawDelta) < centerTolerance;
}

async function pause(ms: number): Promise<void> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

interface FaceSignal {
  ear: number;
  yaw: number;
}

/** Avoid instanceof MediaStream because camera objects may cross iframe realms. */
export function hasLiveVideoTrack(source: unknown): boolean {
  if (!source || typeof source !== "object") return false;
  const candidate = source as { getVideoTracks?: () => Array<{ readyState?: string }> };
  if (typeof candidate.getVideoTracks !== "function") return false;
  try {
    return candidate.getVideoTracks().some((track) => track?.readyState === "live");
  } catch {
    return false;
  }
}

async function detectOneLiveFace(video: HTMLVideoElement): Promise<FaceSignal | null> {
  if (video.readyState < 2 || video.videoWidth < 1 || video.videoHeight < 1) return null;

  // Landmarks alone are substantially cheaper than computing a 128-value
  // recognition descriptor on every frame of the liveness challenge.
  const results = await faceapi
    .detectAllFaces(video, DETECTION_OPTIONS)
    .withFaceLandmarks();

  // Fail closed if the frame has zero or multiple faces.
  if (results.length !== 1) return null;

  const positions = results[0].landmarks.positions;
  if (!positions || positions.length < 48) return null;

  const leftEye = [36, 37, 38, 39, 40, 41].map((index) => positions[index]);
  const rightEye = [42, 43, 44, 45, 46, 47].map((index) => positions[index]);
  const ear = (calculateEyeAspectRatio(leftEye) + calculateEyeAspectRatio(rightEye)) / 2;

  const leftOuterEye = positions[36];
  const rightOuterEye = positions[45];
  const nose = positions[30];
  const eyeDistance = distance(leftOuterEye, rightOuterEye);
  if (!Number.isFinite(eyeDistance) || eyeDistance <= 0) return null;

  const eyeMidpointX = (leftOuterEye.x + rightOuterEye.x) / 2;
  // The preview is mirrored for the employee, so invert the raw image direction.
  const yaw = -(nose.x - eyeMidpointX) / eyeDistance;

  return { ear, yaw };
}

async function nextFaceSignal(video: HTMLVideoElement, deadline: number): Promise<FaceSignal | null> {
  while (performance.now() < deadline) {
    if (!hasLiveVideoTrack(video.srcObject)) {
      throw new Error("A prova de vida exige uma câmera ativa. Fotos enviadas não são aceitas.");
    }

    const signal = await detectOneLiveFace(video);
    if (signal) return signal;
    await pause(160);
  }
  return null;
}

export async function issueFaceLivenessChallenge(
  userId: string,
  purpose: FaceLivenessPurpose,
): Promise<FaceLivenessChallenge> {
  const { data, error } = await supabase.functions.invoke("registrar-ponto-facial", {
    body: { intent: "liveness_challenge", user_id: userId, purpose },
  });

  if (error) {
    // Edge Functions return useful rate-limit/authentication details in the
    // response body; preserve those instead of showing the generic SDK error.
    throw new Error(await getEdgeFunctionErrorMessage(error, "Não foi possível iniciar a prova de vida."));
  }
  if (!data?.success || !data?.challenge?.id || !isValidLivenessSteps(data.challenge.steps)) {
    throw new Error(data?.error || "Não foi possível obter um desafio facial seguro. Tente novamente.");
  }

  const expiresAt = data.challenge.expires_at as string;
  if (!Number.isFinite(Date.parse(expiresAt))) {
    throw new Error("O servidor retornou um prazo inválido para o desafio facial. Tente novamente.");
  }

  return {
    id: data.challenge.id as string,
    steps: data.challenge.steps as FaceLivenessStep[],
    expiresAt,
    // Server grants 120s. Use a 10s safety margin without wall-clock dependence.
    clientDeadline: performance.now() + 110000,
  };
}

export async function runFaceLiveness(
  video: HTMLVideoElement,
  challenge: FaceLivenessChallenge,
  onPrompt: (message: string) => void = () => undefined,
): Promise<FaceLivenessResult> {
  if (!isValidLivenessSteps(challenge.steps)) {
    throw new Error("Desafio de prova de vida inválido. Tente novamente.");
  }

  const startedAt = performance.now();
  if (isFaceLivenessChallengeExpired(challenge)) {
    throw new Error("O desafio facial expirou. Inicie a verificação novamente.");
  }

  // Camera input must be a live MediaStream, never a file or a still image.
  if (!hasLiveVideoTrack(video.srcObject)) {
    throw new Error("Ative a câmera para fazer a prova de vida. Fotos enviadas não são aceitas.");
  }

  onPrompt("Centralize o rosto e olhe para a câmera");
  const calibrationDeadline = performance.now() + 5000;
  const baselineYawSamples: number[] = [];
  const baselineEarSamples: number[] = [];
  let lastSignal: FaceSignal | null = null;

  while (baselineYawSamples.length < 4 && performance.now() < calibrationDeadline) {
    if (isFaceLivenessChallengeExpired(challenge)) throw new Error("O desafio facial expirou. Tente novamente.");
    const signal = await nextFaceSignal(video, calibrationDeadline);
    if (!signal) break;
    // Individual eye shape and camera angle affect EAR. Keep a per-person
    // open-eye baseline instead of requiring one fixed EAR for every employee.
    if (signal.ear >= 0.03) {
      baselineYawSamples.push(signal.yaw);
      baselineEarSamples.push(signal.ear);
      lastSignal = signal;
    }
    await pause(140);
  }

  if (baselineYawSamples.length < 3 || !lastSignal) {
    throw new Error("Não foi possível detectar um rosto estável. Centralize o rosto e tente novamente.");
  }

  const sortedYaw = [...baselineYawSamples].sort((a, b) => a - b);
  const baselineYaw = sortedYaw[Math.floor(sortedYaw.length / 2)];
  const { movement: headTurnThreshold, center: headCenterTolerance } =
    calculateHeadTurnThresholds(baselineYawSamples);
  const sortedEar = [...baselineEarSamples].sort((a, b) => a - b);
  const baselineOpenEar = sortedEar[Math.floor(sortedEar.length / 2)];
  const { closed: closedEyeThreshold, reopened: reopenedEyeThreshold } =
    calculateBlinkThresholds(baselineOpenEar);
  const completedSteps: FaceLivenessStep[] = [];
  // Infer the first turn from the actual camera coordinates, then require the
  // opposite movement. This avoids left/right mirror and device-orientation issues.
  let firstTurnDirection: HeadTurnDirection | null = null;

  for (const step of challenge.steps) {
    onPrompt(step === "blink"
      ? STEP_LABELS.blink
      : firstTurnDirection === null
        ? "Vire a cabeça para um lado e volte ao centro"
        : "Agora vire a cabeça para o lado oposto e volte ao centro");
    const stepDeadline = performance.now() + 15000;
    let blinkClosed = false;
    let movedFrames = 0;
    let returnedFrames = 0;
    let movementStarted = false;
    let verifiedSignal: FaceSignal | null = null;
    let detectedTurnDirection: HeadTurnDirection | null = null;

    while (performance.now() < stepDeadline) {
      if (isFaceLivenessChallengeExpired(challenge)) throw new Error("O desafio facial expirou. Inicie novamente.");
      const signal = await nextFaceSignal(video, stepDeadline);
      if (!signal) break;
      lastSignal = signal;

      if (step === "blink") {
        if (signal.ear < closedEyeThreshold) blinkClosed = true;
        if (blinkClosed && signal.ear > reopenedEyeThreshold) {
          verifiedSignal = signal;
          break;
        }
      } else {
        const delta = signal.yaw - baselineYaw;
        const direction = getHeadTurnDirection(delta);
        const movedCorrectly = step !== "blink" && isHeadTurnDetected(delta, firstTurnDirection, headTurnThreshold);

        if (!movementStarted) {
          movedFrames = movedCorrectly ? movedFrames + 1 : 0;
          if (movedFrames >= 2) {
            movementStarted = true;
            detectedTurnDirection = direction;
            onPrompt("Movimento detectado. Volte a olhar para o centro");
          }
        } else {
          returnedFrames = isHeadBackAtCenter(delta, headCenterTolerance) ? returnedFrames + 1 : 0;
          if (returnedFrames >= 2) {
            verifiedSignal = signal;
            break;
          }
        }
      }

      await pause(140);
    }

    if (!verifiedSignal) {
      const action = step === "blink" ? "a piscada" : "o movimento da cabeça";
      throw new Error(`Não foi possível confirmar ${action}. Tente novamente em boa iluminação.`);
    }

    completedSteps.push(step);
    if (step !== "blink" && firstTurnDirection === null && detectedTurnDirection !== null) {
      firstTurnDirection = detectedTurnDirection;
    }
    lastSignal = verifiedSignal;
    onPrompt(`Etapa ${completedSteps.length} de ${challenge.steps.length} confirmada`);
    await pause(180);
  }

  // Enforce a minimum duration so a challenge cannot be submitted as an instant replay.
  while (performance.now() - startedAt < 4500) {
    if (isFaceLivenessChallengeExpired(challenge)) throw new Error("O desafio facial expirou. Inicie novamente.");
    onPrompt("Prova de vida concluída. Mantenha o rosto centralizado");
    const signal = await nextFaceSignal(video, performance.now() + 700);
    if (signal) lastSignal = signal;
    await pause(120);
  }

  const durationMs = Math.round(performance.now() - startedAt);
  if (!areLivenessStepsComplete(challenge.steps, completedSteps) || !isPlausibleLivenessDuration(durationMs)) {
    throw new Error("A prova de vida não foi validada. Tente novamente.");
  }

  // Compute the recognition descriptor only once, after the live challenge.
  // Retry briefly to tolerate one or two dropped camera frames on slower devices.
  onPrompt("Confirmando a identidade facial...");
  const descriptorDeadline = performance.now() + 5000;
  let finalDescriptor: number[] | null = null;
  while (performance.now() < descriptorDeadline) {
    if (isFaceLivenessChallengeExpired(challenge)) throw new Error("O desafio facial expirou. Inicie novamente.");
    if (!hasLiveVideoTrack(video.srcObject)) {
      throw new Error("A câmera foi desconectada. Reative a câmera e tente novamente.");
    }
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      const results = await faceapi
        .detectAllFaces(video, DETECTION_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();
      if (results.length === 1 && results[0].descriptor.length === 128) {
        finalDescriptor = Array.from(results[0].descriptor);
        break;
      }
    }
    await pause(180);
  }

  if (!finalDescriptor) {
    throw new Error("A prova de vida foi feita, mas não foi possível confirmar o rosto no último quadro. Centralize o rosto e tente novamente.");
  }

  onPrompt("Prova de vida concluída");
  return {
    descriptor: finalDescriptor,
    proof: { completedSteps, durationMs },
  };
}
