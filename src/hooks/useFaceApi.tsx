import { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";

const MODEL_URL = "/models";

export function useFaceApi() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadModels() {
      try {
        setLoading(true);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load face-api models:", err);
        setError("Falha ao carregar modelos de reconhecimento facial");
      } finally {
        setLoading(false);
      }
    }
    loadModels();
  }, []);

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

  return { modelsLoaded, loading, error, detectFace, getDescriptorFromImage, compareFaces };
}
