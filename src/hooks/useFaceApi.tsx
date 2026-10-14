import { useState, useEffect, useCallback } from "react";
import * as faceapi from "face-api.js";

const MODEL_URL = "/models";

// FaceRegistration is rendered once per employee row. Sharing this promise
// prevents every row from downloading/loading the same large models in parallel.
let modelLoadPromise: Promise<void> | null = null;

function ensureFaceModelsLoaded(): Promise<void> {
  if (!modelLoadPromise) {
    modelLoadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
      .then(() => undefined)
      .catch((error) => {
        // Permit an explicit retry after transient network/CDN/model-load failures.
        modelLoadPromise = null;
        throw error;
      });
  }

  return modelLoadPromise;
}

export function useFaceApi() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  const retryModels = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    ensureFaceModelsLoaded()
      .then(() => {
        if (!cancelled) setModelsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load face-api models:", err);
        if (!cancelled) {
          setModelsLoaded(false);
          setError("Não foi possível carregar os modelos de reconhecimento facial. Verifique a conexão e tente novamente.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [retryVersion]);

  const detectFace = useCallback(
    async (input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
      if (!modelsLoaded) return null;
      const detection = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      return detection || null;
    },
    [modelsLoaded]
  );

  const getDescriptorFromImage = useCallback(
    async (imgElement: HTMLImageElement) => {
      if (!modelsLoaded) return null;
      const detection = await faceapi
        .detectSingleFace(imgElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      return detection ? Array.from(detection.descriptor) : null;
    },
    [modelsLoaded]
  );

  const compareFaces = useCallback(
    (descriptor1: Float32Array | number[], descriptor2: Float32Array | number[]) => {
      const d1 = descriptor1 instanceof Float32Array ? descriptor1 : new Float32Array(descriptor1);
      const d2 = descriptor2 instanceof Float32Array ? descriptor2 : new Float32Array(descriptor2);
      return faceapi.euclideanDistance(d1, d2);
    },
    []
  );

  return { modelsLoaded, loading, error, retryModels, detectFace, getDescriptorFromImage, compareFaces };
}
