import { useState, useRef, useEffect, useCallback } from "react";
import { useFaceApi } from "@/hooks/useFaceApi";
import { issueFaceLivenessChallenge, isFaceLivenessChallengeExpired, runFaceLiveness, type FaceLivenessChallenge, type FaceLivenessProof } from "@/lib/faceLiveness";
import { supabase } from "@/integrations/supabase/client";
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
  Fingerprint,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ActionType = PontoAction;
type TodayRegistro = PontoRegistro;

interface MatchedUser {
  user_id: string;
  full_name: string;
  distance: number;
  faceDescriptor: number[];
  livenessChallengeId: string;
  livenessProof: FaceLivenessProof;
}

interface ManualEmployee {
  user_id: string;
  full_name: string;
  matricula: string | null;
}

export default function RegistroPonto() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Reuse an unexpired challenge after a failed client-side liveness step.
  const livenessChallengeRef = useRef<{ userId: string; challenge: FaceLivenessChallenge } | null>(null);
  const { modelsLoaded, loading: modelsLoading, error: modelsError, retryModels, detectFace, compareFaces } = useFaceApi();
  const { toast } = useToast();

  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [matchedUser, setMatchedUser] = useState<MatchedUser | null>(null);
  const [livenessPrompt, setLivenessPrompt] = useState("Mantenha o rosto centralizado");
  const [livenessBlocked, setLivenessBlocked] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastAction, setLastAction] = useState<{ action: string; time: string; name: string } | null>(null);
  const [allDescriptors, setAllDescriptors] = useState<{ user_id: string; full_name: string; descriptor: number[] }[]>([]);
  const [allowedBatidas, setAllowedBatidas] = useState<string[]>(["entrada", "almoco_saida", "almoco_retorno", "saida"]);
  const [todayRegistro, setTodayRegistro] = useState<TodayRegistro | null>(null);
  const [loadingBatidas, setLoadingBatidas] = useState(false);
  const [manualUsers, setManualUsers] = useState<ManualEmployee[]>([]);
  const [selectedManualUserId, setSelectedManualUserId] = useState("");
  const [pontoImage, setPontoImage] = useState<File | null>(null);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load active employees for the standard manual point terminal.
  useEffect(() => {
    async function loadManualUsers() {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, matricula")
        .eq("active", true)
        .order("full_name");
      if (error) {
        toast({ title: "Erro ao carregar colaboradores", description: error.message, variant: "destructive" });
        return;
      }
      const employees = (data || []).map((employee) => ({
        user_id: employee.user_id,
        full_name: employee.full_name || "Colaborador",
        matricula: employee.matricula || null,
      }));
      setManualUsers(employees);
      if (employees.length > 0) setSelectedManualUserId((current) => current || employees[0].user_id);
    }
    void loadManualUsers();
  }, [toast]);

  useEffect(() => {
    if (!selectedManualUserId) {
      setTodayRegistro(null);
      return;
    }
    setTodayRegistro(null);
    setAllowedBatidas(["entrada", "almoco_saida", "almoco_retorno", "saida"]);
    setPontoImage(null);
    void loadUserBatidas(selectedManualUserId);
  }, [selectedManualUserId]);

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
      setLivenessBlocked(false);
      setLivenessPrompt("Mantenha o rosto centralizado");
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
    if (!videoRef.current || !modelsLoaded || allDescriptors.length === 0 || livenessBlocked) return;

    let preserveFailureState = false;
    setScanning(true);
    setMatchedUser(null);
    setLivenessPrompt("Identificando o rosto...");

    try {
      const detection = await detectFace(videoRef.current);
      if (!detection) {
        preserveFailureState = true;
        setLivenessBlocked(true);
        setLivenessPrompt("Não consegui identificar seu rosto nesta imagem. Posicione o rosto de frente, aproxime-se um pouco da câmera e tente novamente.");
        return;
      }

      const currentDescriptor = Array.from(detection.descriptor);
      let bestMatch: { user_id: string; full_name: string; distance: number; descriptor: number[] } | null = null;
      let bestDistance = Infinity;

      for (const stored of allDescriptors) {
        const distance = compareFaces(currentDescriptor, stored.descriptor);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = {
            user_id: stored.user_id,
            full_name: stored.full_name,
            distance,
            descriptor: stored.descriptor,
          };
        }
      }

      if (bestMatch && bestMatch.distance < 0.6) {
        setLivenessPrompt("Solicitando desafio aleatório de prova de vida...");
        // Stop the automatic scanner even when the challenge endpoint fails or rate-limits.
        const pendingChallenge = livenessChallengeRef.current;
        const challenge = pendingChallenge
          && pendingChallenge.userId === bestMatch.user_id
          && !isFaceLivenessChallengeExpired(pendingChallenge.challenge)
          ? pendingChallenge.challenge
          : await issueFaceLivenessChallenge(bestMatch.user_id, "clock_in");
        livenessChallengeRef.current = { userId: bestMatch.user_id, challenge };
        const liveness = await runFaceLiveness(videoRef.current, challenge, setLivenessPrompt);
        const verifiedDistance = compareFaces(liveness.descriptor, bestMatch.descriptor);
        if (verifiedDistance >= 0.6) {
          livenessChallengeRef.current = null;
          throw new Error("O rosto mudou durante a prova de vida. Posicione-se novamente na câmera.");
        }
        livenessChallengeRef.current = null;

        setMatchedUser({
          user_id: bestMatch.user_id,
          full_name: bestMatch.full_name,
          distance: verifiedDistance,
          faceDescriptor: liveness.descriptor,
          livenessChallengeId: challenge.id,
          livenessProof: liveness.proof,
        });
        toast({ title: "Identidade e prova de vida confirmadas", description: `Olá, ${bestMatch.full_name}!` });
        await loadUserBatidas(bestMatch.user_id);
      } else {
        preserveFailureState = true;
        setLivenessBlocked(true);
        setLivenessPrompt("Rosto não reconhecido. Confira se a face está cadastrada e tente novamente.");
        toast({
          title: "Rosto não reconhecido",
          description: "Não encontrei uma biometria compatível. Você pode tentar novamente sem fechar a câmera.",
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
  }, [modelsLoaded, allDescriptors, detectFace, compareFaces, toast, livenessBlocked]);

  const loadUserBatidas = async (userId: string) => {
    setAllowedBatidas(["entrada", "almoco_saida", "almoco_retorno", "saida"]);
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

      const today = getBusinessDate();
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
      const selectedEmployee = manualUsers.find((employee) => employee.user_id === selectedManualUserId);
      if (!selectedEmployee) {
        toast({ title: "Selecione um colaborador", description: "Escolha a pessoa antes de registrar a batida.", variant: "destructive" });
        return;
      }
      setRegistering(true);

      try {
        const geoPayload = await getRequiredBrowserGeoPayload();
        let comprovantePath: string | null = null;

        if (pontoImage) {
          const extension = pontoImage.type === "image/png" ? "png"
            : pontoImage.type === "image/webp" ? "webp" : "jpg";
          comprovantePath = `${selectedEmployee.user_id}/${Date.now()}-${action}.${extension}`;
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
            user_id: selectedEmployee.user_id,
            user_agent: navigator.userAgent,
            terminal_id: "registro-manual-admin",
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

        setLastAction({
          action: labels[action],
          time: new Date().toLocaleTimeString("pt-BR"),
          name: selectedEmployee.full_name,
        });
        toast({ title: "Registrado!", description: `${labels[action]} registrada para ${selectedEmployee.full_name}` });
        await loadUserBatidas(selectedEmployee.user_id);
        setPontoImage(null);
      } catch (err) {
        const message = await getEdgeFunctionErrorMessage(err);
        toast({ title: "Erro", description: message, variant: "destructive" });
      } finally {
        setRegistering(false);
      }
    },
    [manualUsers, selectedManualUserId, pontoImage, toast]
  );

  const actionButtons: { action: ActionType; label: string; icon: React.ElementType; color: string; gradient: string }[] = [
    { action: "entrada", label: "Entrada", icon: LogIn, color: "bg-emerald-600", gradient: "from-emerald-600 to-emerald-700" },
    { action: "almoco_saida", label: "Saída Almoço", icon: UtensilsCrossed, color: "bg-amber-600", gradient: "from-amber-600 to-amber-700" },
    { action: "almoco_retorno", label: "Retorno Almoço", icon: Coffee, color: "bg-blue-600", gradient: "from-blue-600 to-blue-700" },
    { action: "saida", label: "Saída", icon: LogOut, color: "bg-red-600", gradient: "from-red-600 to-red-700" },
  ];

  // Auto-scan logic when camera is activated
  useEffect(() => {
    if (cameraActive && modelsLoaded && allDescriptors.length > 0 && !matchedUser && !scanning && !livenessBlocked) {
      const timer = setTimeout(() => {
        scanFace();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cameraActive, modelsLoaded, allDescriptors.length, matchedUser, scanning, scanFace, livenessBlocked]);

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

            {/* Standard manual point registration */}
            <Card className="w-full max-w-5xl border-none shadow-premium glass-card overflow-hidden">
              <CardHeader className="pb-3 pt-6 px-6">
                <CardTitle className="text-lg font-bold">Registro de Ponto</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-6">
                <p className="text-sm text-muted-foreground">
                  Selecione o colaborador e a batida. O sistema continuará validando a sessão administrativa, o GPS e a sequência dos horários, sem verificação facial.
                </p>

                <div className="space-y-2">
                  <label htmlFor="manual-ponto-employee" className="text-sm font-semibold">Colaborador</label>
                  <select
                    id="manual-ponto-employee"
                    value={selectedManualUserId}
                    onChange={(event) => setSelectedManualUserId(event.currentTarget.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
                    disabled={manualUsers.length === 0 || registering}
                  >
                    {manualUsers.length === 0 && <option value="">Nenhum colaborador ativo encontrado</option>}
                    {manualUsers.map((employee) => (
                      <option key={employee.user_id} value={employee.user_id}>
                        {employee.full_name}{employee.matricula ? ` — ${employee.matricula}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="terminal-ponto-image" className="text-sm font-semibold">Enviar imagem (opcional)</label>
                  <input
                    key={pontoImage?.name || "empty"}
                    id="terminal-ponto-image"
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
                          whileHover={!alreadyRegistered && canRegister ? { scale: 1.03, y: -2 } : {}}
                          whileTap={!alreadyRegistered && canRegister ? { scale: 0.97 } : {}}
                          disabled={registering || loadingBatidas || !selectedManualUserId || alreadyRegistered || !canRegister}
                          onClick={() => registerPonto(btn.action)}
                          className={`relative min-h-24 flex flex-col items-center justify-center gap-2 rounded-2xl transition-all duration-300 ${
                            alreadyRegistered
                              ? "bg-muted text-muted-foreground/40"
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

            {/* Support Message */}
            <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-[0.2em] mt-8 text-center w-full">
              Ponto Pro • v1.0 • Adriano Softwares Secure
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
