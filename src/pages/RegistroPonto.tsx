import { useState, useRef, useEffect, useCallback } from "react";
import { useFaceApi } from "@/hooks/useFaceApi";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { attachStreamToVideoElement, getCameraErrorMessage, isEmbeddedContext, requestUserCameraStream } from "@/lib/camera";
import { canRegisterPontoAction, getEdgeFunctionErrorMessage, getRequiredBrowserGeoPayload, type PontoAction, type PontoRegistro } from "@/lib/registroPonto";
import {
  Camera,
  CheckCircle2,
  Loader2,
  Timer,
  LogIn,
  Coffee,
  UtensilsCrossed,
  LogOut,
  ScanFace,
  AlertTriangle,
  Clock,
  X,
  Zap,
  Check,
  Fingerprint
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ActionType = PontoAction;
type TodayRegistro = PontoRegistro;

interface MatchedUser {
  user_id: string;
  full_name: string;
  distance: number;
}

export default function RegistroPonto() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { modelsLoaded, loading: modelsLoading, error: modelsError, detectFace, compareFaces } = useFaceApi();
  const { toast } = useToast();

  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [matchedUser, setMatchedUser] = useState<MatchedUser | null>(null);
  const [registering, setRegistering] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastAction, setLastAction] = useState<{ action: string; time: string; name: string } | null>(null);
  const [allDescriptors, setAllDescriptors] = useState<{ user_id: string; full_name: string; descriptor: number[] }[]>([]);
  const [allowedBatidas, setAllowedBatidas] = useState<string[]>(["entrada", "almoco_saida", "almoco_retorno", "saida"]);
  const [todayRegistro, setTodayRegistro] = useState<TodayRegistro | null>(null);
  const [loadingBatidas, setLoadingBatidas] = useState(false);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load all face descriptors
  useEffect(() => {
    async function loadDescriptors() {
      const { data: descriptors } = await supabase
        .from("face_descriptors" as any)
        .select("user_id, descriptor");

      if (!descriptors || descriptors.length === 0) return;

      const userIds = (descriptors as any[]).map((d: any) => d.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

      setAllDescriptors(
        (descriptors as any[]).map((d: any) => ({
          user_id: d.user_id,
          full_name: profileMap.get(d.user_id) || "Desconhecido",
          descriptor: d.descriptor,
        }))
      );
    }
    loadDescriptors();
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await requestUserCameraStream();
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error("Camera error (RegistroPonto):", err);
      const baseMessage = getCameraErrorMessage(err);
      toast({ title: "Erro na câmera", description: baseMessage, variant: "destructive" });
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
    setMatchedUser(null);
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
    if (!videoRef.current || !modelsLoaded || allDescriptors.length === 0) return;

    setScanning(true);
    setMatchedUser(null);

    try {
      const detection = await detectFace(videoRef.current);
      if (!detection) {
        setScanning(false);
        return;
      }

      const currentDescriptor = Array.from(detection.descriptor);
      let bestMatch: MatchedUser | null = null;
      let bestDistance = Infinity;

      for (const stored of allDescriptors) {
        const distance = compareFaces(currentDescriptor, stored.descriptor);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = { user_id: stored.user_id, full_name: stored.full_name, distance };
        }
      }

      if (bestMatch && bestMatch.distance < 0.6) {
        setMatchedUser(bestMatch);
        toast({ title: "Bem-vindo!", description: `Olá, ${bestMatch.full_name}!` });
        await loadUserBatidas(bestMatch.user_id);
      } else {
        // Only toast if explicitly failed to match after a detection
        toast({ title: "Não reconhecido", description: "Não te encontrei no sistema.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Face scan error:", err);
    } finally {
      setScanning(false);
    }
  }, [modelsLoaded, allDescriptors, detectFace, compareFaces, toast]);

  const loadUserBatidas = async (userId: string) => {
    setLoadingBatidas(true);
    try {
      const { data: func } = await supabase
        .from("funcionarios")
        .select("escala_id")
        .eq("user_id", userId)
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

      const today = new Date().toISOString().split("T")[0];
      const { data: reg } = await supabase
        .from("registros_ponto")
        .select("entrada, almoco_saida, almoco_retorno, saida")
        .eq("user_id", userId)
        .eq("data", today)
        .maybeSingle();

      setTodayRegistro(reg as TodayRegistro | null);
    } catch (err) {
      console.error("Error loading batidas:", err);
    } finally {
      setLoadingBatidas(false);
    }
  };

  const registerPonto = useCallback(
    async (action: ActionType) => {
      if (!matchedUser) return;
      setRegistering(true);

      try {
        const geoPayload = await getRequiredBrowserGeoPayload();

        const { data, error } = await supabase.functions.invoke("registrar-ponto-facial", {
          body: { action, user_id: matchedUser.user_id, user_agent: navigator.userAgent, ...geoPayload },
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

        setLastAction({ 
          action: labels[action], 
          time: new Date().toLocaleTimeString("pt-BR"),
          name: matchedUser.full_name
        });
        toast({ title: "Registrado!", description: `${labels[action]} registrada para ${matchedUser.full_name}` });
        setMatchedUser(null);
      } catch (err) {
        const message = await getEdgeFunctionErrorMessage(err);
        toast({ title: "Erro", description: message, variant: "destructive" });
      } finally {
        setRegistering(false);
      }
    },
    [matchedUser, toast]
  );

  const actionButtons: { action: ActionType; label: string; icon: React.ElementType; color: string; gradient: string }[] = [
    { action: "entrada", label: "Entrada", icon: LogIn, color: "bg-emerald-600", gradient: "from-emerald-600 to-emerald-700" },
    { action: "almoco_saida", label: "Saída Almoço", icon: UtensilsCrossed, color: "bg-amber-600", gradient: "from-amber-600 to-amber-700" },
    { action: "almoco_retorno", label: "Retorno Almoço", icon: Coffee, color: "bg-blue-600", gradient: "from-blue-600 to-blue-700" },
    { action: "saida", label: "Saída", icon: LogOut, color: "bg-red-600", gradient: "from-red-600 to-red-700" },
  ];

  // Auto-scan logic when camera is activated
  useEffect(() => {
    if (cameraActive && modelsLoaded && allDescriptors.length > 0 && !matchedUser && !scanning) {
      const timer = setTimeout(() => {
        scanFace();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cameraActive, modelsLoaded, allDescriptors.length, matchedUser, scanning, scanFace]);

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-hidden flex flex-col items-center justify-start p-4 sm:p-8">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl z-10 flex flex-col items-center"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
          {/* Main Interaction Column */}
          <div className="lg:col-span-12 xl:col-span-12 flex flex-col items-center gap-6">
            
            {/* Clock & Status - RE-DESIGNED TO BE COMPACT */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-2 px-2">
              <div className="flex flex-col items-center sm:items-start">
                <div className="flex items-baseline gap-2">
                  <p className="text-6xl sm:text-7xl font-black font-mono tabular-nums tracking-tighter text-foreground leading-none">
                    {currentTime.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-2xl font-bold text-primary animate-pulse w-8">
                    {currentTime.getSeconds() % 2 === 0 ? ":" : " "}
                  </p>
                  <p className="text-3xl sm:text-4xl font-bold font-mono text-muted-foreground/40 leading-none">
                    {currentTime.getSeconds().toString().padStart(2, '0')}
                  </p>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 mt-2 ml-1">
                  {currentTime.toLocaleDateString("pt-BR", { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              
              {lastAction && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-4 bg-emerald-500/5 backdrop-blur-md px-5 py-3 rounded-3xl border border-emerald-500/10 shadow-premium"
                >
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-600 leading-none tracking-wider">Sucesso</p>
                    <p className="text-sm font-bold text-foreground mt-0.5 truncate max-w-[140px]">{lastAction.name}</p>
                    <p className="text-[10px] text-muted-foreground">{lastAction.action} às {lastAction.time}</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Recognition Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
              {/* Camera Card */}
              <Card className="border-none shadow-premium glass-card overflow-hidden flex flex-col">
                <CardHeader className="pb-3 pt-6 px-6">
                  <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
                    <ScanFace className="h-5 w-5 text-primary" />
                    Portal de Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6 flex-1 flex flex-col">
                  {!cameraActive && (
                    <div className="flex flex-col items-center justify-center gap-6 py-12 rounded-3xl border-2 border-dashed border-muted animate-in fade-in zoom-in duration-500 flex-1">
                      <div className="h-24 w-24 rounded-full bg-accent/20 flex items-center justify-center group cursor-pointer" onClick={startCamera}>
                        <Camera className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="text-center space-y-2 px-4">
                        <h3 className="font-bold text-lg">Pronto para iniciar?</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
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
                      className="space-y-6 flex-1 flex flex-col"
                    >
                      <div className="relative rounded-3xl overflow-hidden bg-black aspect-[4/3] sm:aspect-square shadow-inner-premium border border-white/10 group flex-1">
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
                              className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center z-30"
                            >
                              <div className="relative mb-4">
                                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                                <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center relative shadow-lg shadow-primary/40">
                                  <ScanFace className="h-10 w-10 text-primary-foreground" />
                                </div>
                              </div>
                              <p className="text-white text-xl font-black tracking-tighter">Buscando colaborador...</p>
                              <p className="text-white/60 text-sm mt-1">Mantenha o rosto centralizado</p>
                              
                              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-beam" />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Corner Accents */}
                        <div className="absolute top-6 left-6 w-10 h-10 border-t-4 border-l-4 border-primary/50 rounded-tl-2xl z-20" />
                        <div className="absolute top-6 right-6 w-10 h-10 border-t-4 border-r-4 border-primary/50 rounded-tr-2xl z-20" />
                        <div className="absolute bottom-6 left-6 w-10 h-10 border-b-4 border-l-4 border-primary/50 rounded-bl-2xl z-20" />
                        <div className="absolute bottom-6 right-6 w-10 h-10 border-b-4 border-r-4 border-primary/50 rounded-br-2xl z-20" />
                      </div>

                      <div className="flex gap-3">
                        <div className="flex-1 flex items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10">
                          <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest text-center">
                            Monitoramento Automático Ativo
                          </p>
                        </div>
                        <motion.button 
                          whileHover={{ scale: 1.1, backgroundColor: "rgba(239, 68, 68, 0.15)" }}
                          whileTap={{ scale: 0.9 }}
                          onClick={stopCamera} 
                          className="rounded-2xl h-14 w-14 flex items-center justify-center bg-white/5 hover:text-red-500 backdrop-blur-md border border-white/10 text-muted-foreground transition-colors"
                        >
                          <X className="h-6 w-6" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              {/* Action/Result Card */}
              <Card className="border-none shadow-premium glass-card overflow-hidden flex flex-col">
                <CardHeader className="pb-3 pt-6 px-6">
                  <CardTitle className="text-lg font-bold">Painel de Registro</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-2 flex-1 flex flex-col items-center justify-center border-t border-white/5">
                  <AnimatePresence mode="wait">
                    {!matchedUser ? (
                      <motion.div 
                        key="no-match"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12 flex flex-col items-center gap-4"
                      >
                        <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center">
                          <ScanFace className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <div>
                          <p className="font-bold text-lg text-muted-foreground transition-all">Aguardando Identificação</p>
                          <p className="text-sm text-muted-foreground/60 max-w-[200px] mt-1 italic">
                            O sistema está escaneando automaticamente. Aproxime seu rosto.
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="match"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full space-y-6"
                      >
                        <div className="flex items-center gap-4 p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 shadow-soft">
                          <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                            <Check className="h-8 w-8 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-xl text-foreground tracking-tight leading-none truncate">{matchedUser.full_name}</p>
                            <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mt-1">Colaborador Identificado</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pb-4">
                          {actionButtons
                            .filter((btn) => allowedBatidas.includes(btn.action))
                            .map((btn, idx) => {
                              const alreadyRegistered = todayRegistro ? !!todayRegistro[btn.action as keyof TodayRegistro] : false;
                              const canRegister = canRegisterPontoAction(btn.action, todayRegistro);

                              return (
                                <motion.button
                                  key={btn.action}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.1 } }}
                                  whileHover={!alreadyRegistered && canRegister ? { scale: 1.03, y: -2 } : {}}
                                  whileTap={!alreadyRegistered && canRegister ? { scale: 0.97 } : {}}
                                  disabled={registering || alreadyRegistered || !canRegister}
                                  onClick={() => registerPonto(btn.action)}
                                  className={`
                                    relative h-32 flex flex-col items-center justify-center gap-2 rounded-3xl transition-all duration-300
                                    ${alreadyRegistered 
                                      ? "bg-muted text-muted-foreground/40" 
                                      : canRegister
                                        ? `bg-gradient-to-br ${btn.gradient} text-white shadow-lg shadow-${btn.color.split('-')[1]}-500/20`
                                        : "bg-muted text-muted-foreground opacity-30 cursor-not-allowed"
                                    }
                                  `}
                                >
                                  <div className={`p-3 rounded-2xl ${alreadyRegistered ? 'bg-background/20' : 'bg-white/20'}`}>
                                    {alreadyRegistered ? (
                                      <CheckCircle2 className="h-6 w-6" />
                                    ) : registering ? (
                                      <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                      <btn.icon className="h-7 w-7" />
                                    )}
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-center px-2">
                                    {alreadyRegistered ? `${btn.label} ✓` : btn.label}
                                  </span>
                                </motion.button>
                              );
                            })}
                        </div>

                        <Button 
                          variant="ghost" 
                          onClick={() => setMatchedUser(null)} 
                          className="w-full rounded-2xl h-10 text-muted-foreground hover:text-foreground font-bold"
                        >
                          Cancelar e trocar de usuário
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </div>

            {/* Support Message */}
            <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-[0.2em] mt-8 text-center w-full">
              Ponto Pro • v1.0 • afCode System Secure
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
