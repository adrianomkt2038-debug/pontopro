import { useState, useRef, useEffect, useCallback } from "react";
import { useFaceApi } from "@/hooks/useFaceApi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { attachStreamToVideoElement, getCameraErrorMessage, isEmbeddedContext, requestUserCameraStream } from "@/lib/camera";
import { Camera, Loader2, ScanFace, CheckCircle2, Upload } from "lucide-react";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

interface FaceRegistrationProps {
  userId: string;
  userName: string;
  onRegistered?: () => void;
}

export function FaceRegistration({ userId, userName, onRegistered }: FaceRegistrationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { modelsLoaded, loading: modelsLoading, detectFace, getDescriptorFromImage } = useFaceApi();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

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
    async (descriptor: number[]) => {
      try {
        // Keep only the descriptor; do not persist raw facial photos.
        await invokeEntityAction("face_descriptor_upsert", {
          target_user_id: userId,
          descriptor,
          avatar_url: null,
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
        console.error(err);
        toast({ title: "Erro", description: "Falha ao salvar dados faciais", variant: "destructive" });
      }
    },
    [userId, userName, toast, stopCamera, onRegistered]
  );

  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded) return;
    setProcessing(true);

    try {
      const detection = await detectFace(videoRef.current);
      if (!detection) {
        toast({ title: "Nenhum rosto detectado", description: "Posicione o rosto na câmera e tente novamente", variant: "destructive" });
        return;
      }
      await saveDescriptor(Array.from(detection.descriptor));
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Falha ao processar rosto", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }, [modelsLoaded, detectFace, saveDescriptor, toast]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !modelsLoaded) return;

      setProcessing(true);
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const url = URL.createObjectURL(file);
        img.src = url;
        await new Promise((resolve) => (img.onload = resolve));

        const descriptor = await getDescriptorFromImage(img);
        URL.revokeObjectURL(url);

        if (!descriptor) {
          toast({ title: "Nenhum rosto detectado", description: "A foto precisa conter um rosto visível", variant: "destructive" });
          return;
        }
        await saveDescriptor(descriptor);
      } catch (err) {
        console.error(err);
        toast({ title: "Erro", description: "Falha ao processar foto", variant: "destructive" });
      } finally {
        setProcessing(false);
      }
    },
    [modelsLoaded, getDescriptorFromImage, saveDescriptor, toast]
  );

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

          {modelsLoaded && !cameraActive && !success && (
            <div className="flex flex-col gap-3">
              <Button onClick={startCamera} className="gap-2 h-12 rounded-xl">
                <Camera className="h-5 w-5" />
                Capturar pela Câmera
              </Button>
              <div className="relative">
                <Button variant="outline" className="w-full gap-2 h-12 rounded-xl" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-5 w-5" />
                  Enviar Foto
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </div>
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

                <div className="absolute inset-x-2 bottom-2 z-20">
                  <div className="rounded-xl bg-background/30 backdrop-blur-sm p-2 flex flex-col md:flex-row gap-2">
                    <Button onClick={captureFromCamera} disabled={processing} className="w-full md:flex-1 gap-2 rounded-xl h-11 text-sm touch-manipulation active:scale-95 transition-transform bg-primary/90 hover:bg-primary" size="lg">
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
                      {processing ? "Processando..." : "Capturar"}
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
