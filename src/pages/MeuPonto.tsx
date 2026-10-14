import { useState, useRef, useEffect, useCallback } from "react";
import { useFaceApi } from "@/hooks/useFaceApi";
import { issueFaceLivenessChallenge, runFaceLiveness, type FaceLivenessProof } from "@/lib/faceLiveness";
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

    let livenessStarted = false;
    let mustRestartCamera = false;
    setScanning(true);
    setVerified(false);
    setLivenessData(null);
    setLivenessPrompt("Comparando a biometria cadastrada...");

    try {
      const detection = await detectFace(videoRef.current);
      if (!detection) {
        setLivenessPrompt("Não foi detectado um rosto. Centralize-se na câmera.");
        return;
      }

      const currentDescriptor = Array.from(detection.descriptor);
      const distance = compareFaces(currentDescriptor, myDescriptor);

      if (distance < 0.6) {
        setLivenessPrompt("Solicitando desafio aleatório de prova de vida...");
        const challenge = await issueFaceLivenessChallenge(user.id, "clock_in");
        livenessStarted = true;
        const liveness = await runFaceLiveness(videoRef.current, challenge, setLivenessPrompt);
        const verifiedDistance = compareFaces(liveness.descriptor, myDescriptor);
        if (verifiedDistance >= 0.6) {
          throw new Error("O rosto mudou durante a prova de vida. Posicione-se novamente na câmera.");
        }

        setLivenessData({
          descriptor: liveness.descriptor,
          challengeId: challenge.id,
          proof: liveness.proof,
        });
        setVerified(true);
        toast({ title: "Identidade e prova de vida confirmadas!", description: `Olá, ${profile?.full_name || "colaborador"}!` });
      } else {
        toast({
          title: "Não reconhecido",
          description: "O rosto detectado não corresponde à biometria cadastrada.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Face scan/liveness error:", err);
      if (livenessStarted) {
        mustRestartCamera = true;
        setLivenessBlocked(true);
        setLivenessPrompt("Prova de vida não concluída. Feche a câmera e inicie novamente.");
      }
      toast({
        title: "Verificação facial não concluída",
        description: err instanceof Error ? err.message : "Não foi possível validar a prova de vida. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
      if (!mustRestartCamera) setLivenessPrompt("Mantenha o rosto centralizado");
    }
  }, [modelsLoaded, myDescriptor, detectFace, compareFaces, toast, profile, user, livenessBlocked]);

  const registerPonto = useCallback(
    async (action: ActionType) => {
      if (!user || !verified || !livenessData) return;
      setRegistering(true);

      try {
        const geoPayload = await getRequiredBrowserGeoPayload();

        const { data, error } = await supabase.functions.invoke("registrar-ponto-facial", {
          body: {
            action,
            user_id: user.id,
            user_agent: navigator.userAgent,
            face_descriptor: livenessData.descriptor,
            liveness_challenge_id: livenessData.challengeId,
            liveness_proof: livenessData.proof,
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
      } catch (err) {
        const message = await getEdgeFunctionErrorMessage(err);
        toast({ title: "Erro", description: message, variant: "destructive" });
      } finally {
        setRegistering(false);
      }
    },
    [user, verified, livenessData, toast]
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
          <h1 className="text-3xl font-extrabold tracking-tight">Registro Facial</h1>
          <p className="text-muted-foreground font-medium mt-1">Confirme sua identidade para bater o ponto</p>
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
        {/* Camera verification area */}
        <Card className="lg:col-span-12 border-none shadow-premium glass-card overflow-hidden">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
              <ScanFace className="h-5 w-5 text-primary" />
              Verificação em Tempo Real
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-6 pb-6">
            {!modelsLoading && modelsError && (
              <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-2 text-destructive">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm">{modelsError}</p>
                </div>
                <Button variant="outline" onClick={retryModels} className="w-full gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Tentar carregar modelos novamente
                </Button>
              </div>
            )}

            {!myDescriptor && !modelsLoading && !modelsError && (
              <div className="flex items-center gap-3 p-5 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <AlertTriangle className="h-6 w-6 shrink-0" />
                <div>
                  <p className="font-bold text-sm">Cadastro Facial Pendente</p>
                  <p className="text-xs opacity-80">Você não possui um perfil facial cadastrado. Contate o RH.</p>
                </div>
              </div>
            )}

            {modelsLoading && (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                  <ScanFace className="h-6 w-6 absolute inset-0 m-auto text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground">Iniciando Biometria</p>
                  <p className="text-xs">Preparando modelos de visão computacional...</p>
                </div>
              </div>
            )}

            {!cameraActive && modelsError == null && myDescriptor && (
              <div className="flex flex-col items-center justify-center gap-6 py-12 rounded-2xl border-2 border-dashed border-muted animate-in fade-in zoom-in duration-500">
                <div className="h-24 w-24 rounded-full bg-accent/20 flex items-center justify-center group cursor-pointer" onClick={startCamera}>
                  <Camera className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-bold text-lg">Pronto para Registrar?</h3>
                  <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">
                    O scanner iniciará automaticamente após ativar a câmera.
                  </p>
                </div>
                <Button size="lg" onClick={startCamera} className="gap-2 rounded-2xl h-14 px-10 shadow-premium bg-primary hover:bg-primary/90 text-base font-bold">
                  <Fingerprint className="h-5 w-5" />
                  Registrar Ponto
                </Button>
              </div>
            )}

            {cameraActive && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="relative rounded-3xl overflow-hidden bg-black aspect-square shadow-inner-premium border border-white/10 group">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                    
                    {/* Scanning Overlay */}
                    <AnimatePresence>
                      {scanning && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center"
                        >
                          <div className="relative mb-4">
                            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center relative shadow-lg shadow-primary/40">
                              <ScanFace className="h-8 w-8 text-primary-foreground" />
                            </div>
                          </div>
                          <p className="text-white font-black tracking-tight text-lg">Verificação facial segura</p>
                          <p className="text-white/70 text-xs mt-1">{livenessPrompt}</p>
                          
                          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-beam" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Corner Accents */}
                    <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-primary/50 rounded-tl-xl z-20" />
                    <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-primary/50 rounded-tr-xl z-20" />
                    <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-primary/50 rounded-bl-xl z-20" />
                    <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-primary/50 rounded-br-xl z-20" />
                    
                    {!verified && !scanning && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-20">
                        <p className="text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          Scanner em execução...
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6 lg:mt-0">
                    {/* Verified Status Card */}
                    <AnimatePresence mode="wait">
                      {verified ? (
                        <motion.div 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex flex-col gap-4 p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 shadow-soft"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/40">
                              <Check className="h-8 w-8 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-xl text-foreground tracking-tight leading-none truncate">{profile?.full_name}</p>
                              <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mt-1">Identidade Confirmada</p>
                            </div>
                          </div>

                          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Selecione uma ação:</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {actionButtons
                                .filter((btn) => allowedBatidas.includes(btn.action))
                                .map((btn) => {
                                  const alreadyRegistered = todayRegistro ? !!todayRegistro[btn.action as keyof TodayRegistro] : false;
                                  const canRegister = canRegisterPontoAction(btn.action, todayRegistro);

                                  return (
                                    <motion.button
                                      key={btn.action}
                                      whileHover={!alreadyRegistered && verified && canRegister ? { scale: 1.05 } : {}}
                                      whileTap={!alreadyRegistered && verified && canRegister ? { scale: 0.95 } : {}}
                                      disabled={registering || alreadyRegistered || !verified || !canRegister}
                                      onClick={() => registerPonto(btn.action)}
                                      className={`
                                        relative h-24 flex flex-col items-center justify-center gap-2 rounded-2xl transition-all duration-300
                                        ${alreadyRegistered 
                                          ? "bg-muted cursor-default opacity-40" 
                                          : (verified && canRegister)
                                            ? `bg-gradient-to-br ${btn.gradient} text-white shadow-lg shadow-${btn.color.split('-')[1]}-500/20`
                                            : "bg-muted text-muted-foreground opacity-20 cursor-not-allowed"
                                        }
                                      `}
                                    >
                                      <btn.icon className="h-5 w-5" />
                                      <span className="text-[10px] font-black uppercase tracking-tight text-center px-1">
                                        {btn.label}
                                      </span>
                                    </motion.button>
                                  );
                                })}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center gap-4 py-20 text-center bg-accent/5 rounded-3xl border border-dashed border-border"
                        >
                          <div className="h-16 w-16 rounded-2xl bg-muted/20 flex items-center justify-center">
                            <ScanFace className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                          <div>
                            <p className="font-bold text-muted-foreground">Aguardando Scanner</p>
                            <p className="text-xs text-muted-foreground/60 max-w-[200px] mt-1 italic">
                              Enquadre seu rosto para liberar as opções de registro.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button 
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={stopCamera} 
                      className="w-full rounded-2xl h-14 flex items-center justify-center gap-2 bg-white/5 hover:text-red-500 backdrop-blur-md border border-white/10 text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px] transition-all"
                    >
                      <X className="h-4 w-4" />
                      Encerrar Sessão
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
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
