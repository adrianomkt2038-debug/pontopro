import { useState, useRef, useEffect, useCallback } from "react";
import { useFaceApi } from "@/hooks/useFaceApi";
import { issueFaceLivenessChallenge, isFaceLivenessChallengeExpired, runFaceLiveness, type FaceLivenessChallenge, type FaceLivenessProof } from "@/lib/faceLiveness";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { attachStreamToVideoElement, getCameraErrorMessage, isEmbeddedContext, requestUserCameraStream } from "@/lib/camera";
import { canRegisterPontoAction, getEdgeFunctionErrorMessage, getRequiredBrowserGeoPayload, type PontoAction, type PontoRegistro } from "@/lib/registroPonto";
import { getBusinessDate } from "@/lib/businessDate";
import {
  Camera,
  CheckCircle2,
  Loader2,
  LogIn,
  Coffee,
  UtensilsCrossed,
  LogOut,
  ScanFace,
  AlertTriangle,
  Clock,
  Check,
  Zap,
  X,
  Fingerprint,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ActionType = PontoAction;
type TodayRegistro = PontoRegistro;

export default function MeuPonto() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Reuse an unexpired challenge after a failed client-side liveness step.
  const livenessChallengeRef = useRef<FaceLivenessChallenge | null>(null);
  const { modelsLoaded, loading: modelsLoading, error: modelsError, retryModels, detectFace, compareFaces } = useFaceApi();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [verified, setVerified] = useState(false);
  const [livenessData, setLivenessData] = useState<{ descriptor: number[]; challengeId: string; proof: FaceLivenessProof } | null>(null);
  const [livenessPrompt, setLivenessPrompt] = useState("Mantenha o rosto centralizado");
  const [livenessBlocked, setLivenessBlocked] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastAction, setLastAction] = useState<{ action: string; time: string } | null>(null);
  const [myDescriptor, setMyDescriptor] = useState<number[] | null>(null);
  const [allowedBatidas, setAllowedBatidas] = useState<string[]>(["entrada", "almoco_saida", "almoco_retorno", "saida"]);
  const [todayRegistro, setTodayRegistro] = useState<TodayRegistro | null>(null);
  const [loadingBatidas, setLoadingBatidas] = useState(false);
  const [pontoImage, setPontoImage] = useState<File | null>(null);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load MY face descriptor
  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase
        .from("face_descriptors" as any)
        .select("descriptor")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (data) setMyDescriptor((data as any).descriptor);
    }
    load();
  }, [user]);

  // Load batidas config and today's registro
  useEffect(() => {
    if (!user) return;
    loadUserBatidas();
  }, [user]);

  const loadUserBatidas = async () => {
    if (!user) return;
    setLoadingBatidas(true);
    try {
      const { data: func } = await supabase
        .from("funcionarios")
        .select("escala_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (func?.escala_id) {
        const { data: escala } = await supabase
          .from("escalas")
          .select("tipo_registro_id")
          .eq("id", func.escala_id)
          .maybeSingle();

        if (escala?.tipo_registro_id) {
          const { data: tipo } = await supabase
            .from("tipos_registro" as any)
            .select("batidas")
            .eq("id", escala.tipo_registro_id)
            .maybeSingle();

          if (tipo && (tipo as any).batidas) {
            setAllowedBatidas((tipo as any).batidas);
          }
        }
      }

      const today = getBusinessDate();
      const { data: reg } = await supabase
        .from("registros_ponto")
        .select("entrada, almoco_saida, almoco_retorno, saida")
        .eq("user_id", user.id)
        .eq("data", today)
        .maybeSingle();

      setTodayRegistro(reg as TodayRegistro | null);
    } catch (err) {
      console.error("Error loading batidas:", err);
    } finally {
      setLoadingBatidas(false);
    }
  };

  const startCamera = useCallback(async () => {
    try {
      setLivenessBlocked(false);
      setLivenessPrompt("Mantenha o rosto centralizado");
      const stream = await requestUserCameraStream();
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      const baseMessage = getCameraErrorMessage(err);
      const previewHint = isEmbeddedContext() ? " Teste no link publicado." : "";
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
    setVerified(false);
    setLivenessData(null);
    setLivenessPrompt("Mantenha o rosto centralizado");
  }, []);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    let cancelled = false;
    const vid = videoRef.current;
    const stream = streamRef.current;

    (async () => {
      try {
        await attachStreamToVideoElement(vid, stream);
      } catch (err) {
        if (cancelled) return;
        toast({ title: "Erro na câmera", description: getCameraErrorMessage(err), variant: "destructive" });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setCameraActive(false);
      }
    })();

    return () => { cancelled = true; };
  }, [cameraActive, toast]);

  const scanFace = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded || !myDescriptor || !user || livenessBlocked) return;

    let preserveFailureState = false;
    setScanning(true);
    setVerified(false);
    setLivenessData(null);
    setLivenessPrompt("Comparando a biometria cadastrada...");

    try {
      const detection = await detectFace(videoRef.current);
      if (!detection) {
        preserveFailureState = true;
        setLivenessBlocked(true);
        setLivenessPrompt("Não consegui identificar seu rosto nesta imagem. Posicione o rosto de frente, aproxime-se um pouco da câmera e tente novamente.");
        return;
      }

      const currentDescriptor = Array.from(detection.descriptor);
      const distance = compareFaces(currentDescriptor, myDescriptor);

      if (distance < 0.6) {
        setLivenessPrompt("Solicitando desafio aleatório de prova de vida...");
        // Stop the automatic scanner even when the challenge endpoint fails or rate-limits.
        const pendingChallenge = livenessChallengeRef.current;
        const challenge = pendingChallenge && !isFaceLivenessChallengeExpired(pendingChallenge)
          ? pendingChallenge
          : await issueFaceLivenessChallenge(user.id, "clock_in");
        livenessChallengeRef.current = challenge;
        const liveness = await runFaceLiveness(videoRef.current, challenge, setLivenessPrompt);
        const verifiedDistance = compareFaces(liveness.descriptor, myDescriptor);
        if (verifiedDistance >= 0.6) {
          livenessChallengeRef.current = null;
          throw new Error("O rosto mudou durante a prova de vida. Posicione-se novamente na câmera.");
        }
        livenessChallengeRef.current = null;

        setLivenessData({
          descriptor: liveness.descriptor,
          challengeId: challenge.id,
          proof: liveness.proof,
        });
        setVerified(true);
        toast({ title: "Identidade e prova de vida confirmadas!", description: `Olá, ${profile?.full_name || "colaborador"}!` });
      } else {
        preserveFailureState = true;
        setLivenessBlocked(true);
        setLivenessPrompt("Rosto não reconhecido. Confira se sua face está cadastrada e tente novamente.");
        toast({
          title: "Rosto não reconhecido",
          description: "A imagem não corresponde à biometria cadastrada. Você pode tentar novamente sem fechar a câmera.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Face scan/liveness error:", err);
      preserveFailureState = true;
      setLivenessBlocked(true);
      const failureMessage = err instanceof Error ? err.message : "";
      const rateLimited = /muitas tentativas|aguarde um minuto/i.test(failureMessage);
      setLivenessPrompt(rateLimited
        ? "Limite temporário de tentativas. Aguarde um minuto antes de tentar novamente."
        : (failureMessage || "Não foi possível verificar o rosto. Confira a câmera e tente novamente."));
      toast({
        title: "Verificação facial não concluída",
        description: err instanceof Error ? err.message : "Não foi possível validar a prova de vida. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
      if (!preserveFailureState) setLivenessPrompt("Mantenha o rosto centralizado");
    }
  }, [modelsLoaded, myDescriptor, detectFace, compareFaces, toast, profile, user, livenessBlocked]);

  const registerPonto = useCallback(
    async (action: ActionType) => {
      if (!user) return;
      setRegistering(true);

      try {
        const geoPayload = await getRequiredBrowserGeoPayload();
        let comprovantePath: string | null = null;

        if (pontoImage) {
          const extension = pontoImage.type === "image/png" ? "png"
            : pontoImage.type === "image/webp" ? "webp" : "jpg";
          comprovantePath = `${user.id}/${Date.now()}-${action}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from("ponto-comprovantes")
            .upload(comprovantePath, pontoImage, {
              contentType: pontoImage.type,
              upsert: false,
            });
          if (uploadError) throw new Error(`Não foi possível enviar a imagem: ${uploadError.message}`);
        }

        const { data, error } = await supabase.functions.invoke("registrar-ponto-facial", {
          body: {
            intent: "manual_clock_action",
            action,
            user_id: user.id,
            user_agent: navigator.userAgent,
            comprovante_path: comprovantePath,
            ...geoPayload,
          },
        });

        if (error) throw error;
        if (!data.success) {
          toast({ title: "Erro", description: data.error, variant: "destructive" });
          return;
        }

        const labels: Record<ActionType, string> = {
          entrada: "Entrada",
          almoco_saida: "Saída Almoço",
          almoco_retorno: "Retorno Almoço",
          saida: "Saída",
        };

        setLastAction({ action: labels[action], time: new Date().toLocaleTimeString("pt-BR") });
        toast({ title: "Registrado!", description: `${labels[action]} registrada com sucesso` });
        await loadUserBatidas();
        setVerified(false);
        setLivenessData(null);
        setPontoImage(null);
      } catch (err) {
        const message = await getEdgeFunctionErrorMessage(err);
        toast({ title: "Erro", description: message, variant: "destructive" });
      } finally {
        setRegistering(false);
      }
    },
    [user, pontoImage, toast]
  );

  const actionButtons: { action: ActionType; label: string; icon: React.ElementType; color: string; gradient: string }[] = [
    { action: "entrada", label: "Entrada", icon: LogIn, color: "bg-emerald-600", gradient: "from-emerald-600 to-emerald-700" },
    { action: "almoco_saida", label: "Saída Almoço", icon: UtensilsCrossed, color: "bg-amber-600", gradient: "from-amber-600 to-amber-700" },
    { action: "almoco_retorno", label: "Retorno Almoço", icon: Coffee, color: "bg-blue-600", gradient: "from-blue-600 to-blue-700" },
    { action: "saida", label: "Saída", icon: LogOut, color: "bg-red-600", gradient: "from-red-600 to-red-700" },
  ];

  // Auto-scan logic when camera is activated
  useEffect(() => {
    if (cameraActive && modelsLoaded && myDescriptor && !verified && !scanning && !livenessBlocked) {
      const timer = setTimeout(() => {
        scanFace();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [cameraActive, modelsLoaded, myDescriptor, verified, scanning, scanFace, livenessBlocked]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 sm:pb-0"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Meu Ponto</h1>
          <p className="text-muted-foreground font-medium mt-1">Registre seu horário com sua conta e localização, sem verificação facial.</p>
        </div>
        <div className="flex items-center gap-3 bg-card px-5 py-3 rounded-2xl shadow-soft border border-border/50">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <p className="text-xl font-bold font-mono tabular-nums leading-none">
              {currentTime.getHours().toString().padStart(2, '0')}:
              {currentTime.getMinutes().toString().padStart(2, '0')}:
              <span className="text-primary">{currentTime.getSeconds().toString().padStart(2, '0')}</span>
            </p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">
              {currentTime.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-12 border-none shadow-premium glass-card overflow-hidden">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
              <Clock className="h-5 w-5 text-primary" />
              Registrar Ponto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-6 pb-6">
            <p className="text-sm text-muted-foreground">
              Selecione a batida correspondente. A conta autenticada, a localização e a sequência dos horários continuam sendo verificadas.
            </p>
            <div className="space-y-2">
              <label htmlFor="ponto-image" className="text-sm font-semibold">Enviar imagem (opcional)</label>
              <input
                key={pontoImage?.name || "empty"}
                id="ponto-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full rounded-xl border border-border bg-background px-3 py-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-primary-foreground"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)) {
                    toast({ title: "Imagem inválida", description: "Envie JPG, PNG ou WEBP de até 8 MB.", variant: "destructive" });
                    event.currentTarget.value = "";
                    setPontoImage(null);
                    return;
                  }
                  setPontoImage(file);
                }}
              />
              {pontoImage && <p className="text-xs text-muted-foreground">Imagem anexada: {pontoImage.name}</p>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {actionButtons
                .filter((btn) => allowedBatidas.includes(btn.action))
                .map((btn) => {
                  const alreadyRegistered = todayRegistro ? !!todayRegistro[btn.action as keyof TodayRegistro] : false;
                  const canRegister = canRegisterPontoAction(btn.action, todayRegistro);
                  return (
                    <motion.button
                      key={btn.action}
                      whileHover={!alreadyRegistered && canRegister ? { scale: 1.03 } : {}}
                      whileTap={!alreadyRegistered && canRegister ? { scale: 0.97 } : {}}
                      disabled={registering || loadingBatidas || alreadyRegistered || !canRegister || !user}
                      onClick={() => registerPonto(btn.action)}
                      className={`relative min-h-24 flex flex-col items-center justify-center gap-2 rounded-2xl transition-all duration-300 ${
                        alreadyRegistered
                          ? "bg-muted cursor-default opacity-40"
                          : canRegister
                            ? `bg-gradient-to-br ${btn.gradient} text-white shadow-lg`
                            : "bg-muted text-muted-foreground opacity-40 cursor-not-allowed"
                      }`}
                    >
                      {registering ? <Loader2 className="h-5 w-5 animate-spin" /> : <btn.icon className="h-5 w-5" />}
                      <span className="text-xs font-black uppercase tracking-tight text-center px-1">{alreadyRegistered ? `${btn.label} ✓` : btn.label}</span>
                    </motion.button>
                  );
                })}
            </div>
            {loadingBatidas && <p className="text-xs text-muted-foreground">Carregando os registros de hoje...</p>}
          </CardContent>
        </Card>

        {/* Unified Records Timeline */}
        <Card className="lg:col-span-12 border-none shadow-premium bg-card/60 overflow-hidden">
          <CardHeader className="pb-3 px-6 pt-6 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">Resumo do Dia</CardTitle>
            <Badge variant="outline" className="font-bold border-primary/20 text-primary bg-primary/5">Hoje</Badge>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const steps: { key: keyof TodayRegistro; label: string; icon: React.ElementType }[] = [
                  { key: "entrada", label: "Entrada", icon: LogIn },
                  { key: "almoco_saida", label: "Saída Almoço", icon: UtensilsCrossed },
                  { key: "almoco_retorno", label: "Retorno Almoço", icon: Coffee },
                  { key: "saida", label: "Saída", icon: LogOut },
                ];
                const filteredSteps = steps.filter((s) => allowedBatidas.includes(s.key));

                return filteredSteps.map((step) => {
                  const value = todayRegistro?.[step.key];
                  const done = !!value;
                  const timeStr = value
                    ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "--:--";
                  
                  return (
                    <div key={step.key} className={`
                      p-4 rounded-3xl flex items-center gap-4 transition-all duration-300 border
                      ${done ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/30 border-transparent text-muted-foreground/40"}
                    `}>
                      <div className={`
                        h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm
                        ${done ? "bg-emerald-500 text-white" : "bg-muted/50 text-muted-foreground/20"}
                      `}>
                        {done ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-[10px] font-black uppercase tracking-widest truncate ${done ? "text-emerald-600" : "text-muted-foreground/40"}`}>
                          {step.label}
                        </h4>
                        <p className={`text-lg font-mono font-black tabular-nums tracking-tighter ${done ? "text-foreground" : "text-muted-foreground/20"}`}>
                          {timeStr}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            {lastAction && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 flex items-center gap-2 text-[10px] text-muted-foreground justify-center font-black uppercase tracking-[0.2em]"
              >
                <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                Último Registro: {lastAction.action} às {lastAction.time}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-[0.2em] text-center w-full">
        Ponto Pro • v1.0 • Adriano Softwares Secure
      </p>
    </motion.div>
  );
}
