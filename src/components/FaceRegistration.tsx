import { useState, useRef, useEffect, useCallback } from "react";
import { useFaceApi } from "@/hooks/useFaceApi";
import { issueFaceLivenessChallenge, isFaceLivenessChallengeExpired, runFaceLiveness, type FaceLivenessChallenge } from "@/lib/faceLiveness";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { attachStreamToVideoElement, getCameraErrorMessage, isEmbeddedContext, requestUserCameraStream } from "@/lib/camera";
import { Camera, Loader2, ScanFace, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

interface FaceRegistrationProps {
  userId: string;
  userName: string;
  onRegistered?: () => void;
}

export function FaceRegistration({ userId, userName, onRegistered }: FaceRegistrationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Keep a failed but still-valid enrollment challenge for the next user attempt.
  const livenessChallengeRef = useRef<{ userId: string; challenge: FaceLivenessChallenge } | null>(null);
  const { modelsLoaded, loading: modelsLoading, error: modelsError, retryModels } = useFaceApi();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [livenessPrompt, setLivenessPrompt] = useState("Posicione o rosto na câmera");

  const startCamera = useCallback(async () => {
    try {
      const stream = await requestUserCameraStream();
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error("Camera error (FaceRegistration):", err);
      const baseMessage = getCameraErrorMessage(err);
      const previewHint = isEmbeddedContext()
        ? " Se estiver no preview interno, teste também no link publicado do app."
        : "";
      toast({ title: "Erro na câmera", description: `${baseMessage}${previewHint}`, variant: "destructive" });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setLivenessPrompt("Posicione o rosto na câmera");
  }, []);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;

    let cancelled = false;
    const currentVideo = videoRef.current;
    const currentStream = streamRef.current;

    (async () => {
      try {
        await attachStreamToVideoElement(currentVideo, currentStream);
      } catch (err) {
        if (cancelled) return;

        console.error("Camera bind error (FaceRegistration):", err);
        const baseMessage = getCameraErrorMessage(err);
        const previewHint = isEmbeddedContext()
          ? " Se estiver no preview interno, teste também no link publicado do app."
          : "";
        toast({ title: "Erro na câmera", description: `${baseMessage}${previewHint}`, variant: "destructive" });

        currentStream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraActive(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cameraActive, toast]);

  const saveDescriptor = useCallback(
    async (descriptor: number[], challengeId: string, proof: { completedSteps: string[]; durationMs: number }) => {
      try {
        // Persist only the descriptor and proof metadata; never upload raw facial photos or video.
        await invokeEntityAction("face_descriptor_upsert", {
          target_user_id: userId,
          descriptor,
          avatar_url: null,
          liveness_challenge_id: challengeId,
          liveness_proof: proof,
        });

        setSuccess(true);
        toast({ title: "Sucesso!", description: `Face de ${userName} cadastrada com sucesso` });
        onRegistered?.();
        setTimeout(() => {
          stopCamera();
          setOpen(false);
          setSuccess(false);
        }, 1500);
      } catch (err) {
        console.error("Face descriptor save failed:", err);
        toast({
          title: "Erro ao salvar o cadastro facial",
          description: err instanceof Error ? err.message : "Falha ao salvar os dados faciais. Tente novamente.",
          variant: "destructive",
        });
      }
    },
    [userId, userName, toast, stopCamera, onRegistered]
  );

  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded || processing) return;
    setProcessing(true);

    try {
      setLivenessPrompt("Solicitando desafio aleatório de prova de vida...");
      const pendingChallenge = livenessChallengeRef.current;
      const challenge = pendingChallenge
        && pendingChallenge.userId === userId
        && !isFaceLivenessChallengeExpired(pendingChallenge.challenge)
        ? pendingChallenge.challenge
        : await issueFaceLivenessChallenge(userId, "enrollment");
      livenessChallengeRef.current = { userId, challenge };
      const result = await runFaceLiveness(videoRef.current, challenge, setLivenessPrompt);
      livenessChallengeRef.current = null;
      await saveDescriptor(result.descriptor, challenge.id, result.proof);
    } catch (err) {
      console.error("Face enrollment liveness failed:", err);
      toast({
        title: "Cadastro não concluído",
        description: err instanceof Error ? err.message : "Não foi possível validar a prova de vida. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setLivenessPrompt("Posicione o rosto na câmera");
    }
  }, [modelsLoaded, processing, userId, saveDescriptor, toast]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { stopCamera(); setSuccess(false); }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ScanFace className="h-4 w-4" />
          Cadastrar Face
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Face - {userName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {modelsLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando modelos...
            </div>
          )}

          {!modelsLoading && modelsError && (
            <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-2 text-destructive">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm">{modelsError}</p>
              </div>
              <Button variant="outline" onClick={retryModels} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar carregar novamente
              </Button>
            </div>
          )}

          {modelsLoaded && !cameraActive && !success && (
            <div className="flex flex-col gap-3">
              <Button onClick={startCamera} className="gap-2 h-12 rounded-xl">
                <Camera className="h-5 w-5" />
                Usar câmera ao vivo
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                O cadastro exige piscada e movimentos aleatórios da cabeça. Arquivos de foto não são aceitos.
              </p>
              {isEmbeddedContext() && (
                <p className="text-xs text-muted-foreground text-center">
                  Se a câmera não abrir no preview, teste no link publicado do app.
                </p>
              )}
            </div>
          )}

          {cameraActive && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4]">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                <div className="absolute inset-x-2 top-2 z-20 rounded-lg bg-black/70 p-2 text-center text-xs font-semibold text-white">
                  {livenessPrompt}
                </div>

                <div className="absolute inset-x-2 bottom-2 z-20">
                  <div className="rounded-xl bg-background/30 backdrop-blur-sm p-2 flex flex-col md:flex-row gap-2">
                    <Button onClick={captureFromCamera} disabled={processing} className="w-full md:flex-1 gap-2 rounded-xl h-11 text-sm touch-manipulation active:scale-95 transition-transform bg-primary/90 hover:bg-primary" size="lg">
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
                      {processing ? "Verificando prova de vida..." : "Prova de vida e cadastro"}
                    </Button>
                    <Button variant="outline" onClick={stopCamera} className="w-full md:w-auto rounded-xl h-11 text-sm bg-background/80 border-border/60 hover:bg-background touch-manipulation active:scale-95 transition-transform" size="lg">
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              <p className="text-lg font-medium text-foreground">Face cadastrada!</p>
            </div>
          )}

          {processing && !cameraActive && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processando foto...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
