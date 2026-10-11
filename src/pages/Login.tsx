import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Timer, Check, X, Eye, EyeOff, ShieldAlert, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { CaptchaCheckbox } from "@/components/CaptchaCheckbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Número", test: (p: string) => /\d/.test(p) },
  { label: "Caractere especial (!@#$%...)", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const strength = password.length === 0 ? 0 : (passed / PASSWORD_RULES.length) * 100;

  const strengthLabel =
    strength <= 20 ? "Muito fraca" :
    strength <= 40 ? "Fraca" :
    strength <= 60 ? "Razoável" :
    strength <= 80 ? "Forte" :
    "Muito forte";

  const strengthColor =
    strength <= 20 ? "bg-destructive" :
    strength <= 40 ? "bg-warning" :
    strength <= 60 ? "bg-warning" :
    strength <= 80 ? "bg-success" :
    "bg-success";

  if (password.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Força da senha</span>
        <span className={`font-medium ${strength >= 80 ? "text-success" : strength >= 60 ? "text-warning" : "text-destructive"}`}>
          {strengthLabel}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
          style={{ width: `${strength}%` }}
        />
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.label} className={`flex items-center gap-1.5 text-[10px] ${ok ? "text-success font-medium" : "text-muted-foreground"}`}>
              {ok ? <Check className="h-2.5 w-2.5 shrink-0" /> : <div className="h-1 w-1 rounded-full bg-muted-foreground shrink-0 ml-1" />}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signupPassword, setSignupPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showSignupPass, setShowSignupPass] = useState(false);
  const [loginCaptcha, setLoginCaptcha] = useState(false);
  const [signupCaptcha, setSignupCaptcha] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [allowSignup, setAllowSignup] = useState<boolean | null>(null);
  const [requireEmailConfirm, setRequireEmailConfirm] = useState(true);

  useEffect(() => {
    supabase
      .from("configuracoes_sistema")
      .select("chave, valor")
      .in("chave", ["permitir_auto_cadastro", "exigir_confirmacao_email"])
      .then(({ data }) => {
        const map = Object.fromEntries((data || []).map((d) => [d.chave, d.valor]));
        setAllowSignup(map["permitir_auto_cadastro"] === "true");
        setRequireEmailConfirm(map["exigir_confirmacao_email"] !== "false");
      });
  }, []);

  const isPasswordValid = useMemo(
    () => PASSWORD_RULES.every((r) => r.test(signupPassword)),
    [signupPassword]
  );

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!loginCaptcha) {
      toast.error("Por favor, confirme que não é um robô.");
      return;
    }
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string).trim();
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!signupCaptcha) {
      toast.error("Por favor, confirme que não é um robô.");
      return;
    }
    if (allowSignup === false) {
      toast.error("O cadastro de novos usuários está desativado.");
      return;
    }
    if (!isPasswordValid) {
      toast.error("A senha não atende todos os requisitos de segurança.");
      return;
    }
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string).trim();
    const password = formData.get("password") as string;
    const fullName = (formData.get("fullName") as string).trim();

    if (fullName.length < 2 || fullName.length > 100) {
      toast.error("Nome deve ter entre 2 e 100 caracteres.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else if (requireEmailConfirm) {
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    } else {
      toast.success("Conta criada com sucesso!");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background overflow-hidden p-4">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-blue-500/10 rounded-full blur-[80px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <div className="mb-8 text-center">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-premium"
          >
            <Timer className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl font-extrabold tracking-tight"
          >
            Ponto Pro
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-muted-foreground mt-1 font-medium"
          >
            Gestão inteligente de jornada e RH
          </motion.p>
        </div>

        <Card className="border border-white/20 dark:border-white/10 shadow-premium glass-card rounded-3xl overflow-hidden">
          <CardContent className="p-0">
            <Tabs defaultValue="login" className="w-full">
              <div className="px-6 pt-6">
                <TabsList className={`grid w-full bg-accent/30 p-1 rounded-2xl ${allowSignup === false ? '' : 'grid-cols-2'}`}>
                  <TabsTrigger value="login" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                    Entrar
                  </TabsTrigger>
                  {allowSignup !== false && (
                    <TabsTrigger value="signup" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      Criar Conta
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className="p-8">
                <TabsContent value="login" className="mt-0 space-y-6">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                        E-mail de acesso
                      </Label>
                      <Input 
                        id="login-email" 
                        name="email" 
                        type="email" 
                        required 
                        placeholder="seu@email.com" 
                        className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary shadow-inner"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <Label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Senha
                        </Label>
                        <button
                          type="button"
                          onClick={() => setShowForgot(true)}
                          className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-tight"
                        >
                          Esqueci a senha
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="login-password"
                          name="password"
                          type={showLoginPass ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary pr-12 shadow-inner"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPass(!showLoginPass)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <CaptchaCheckbox verified={loginCaptcha} onVerified={setLoginCaptcha} />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-12 rounded-xl text-sm font-bold shadow-premium bg-primary hover:bg-primary/90 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" 
                      disabled={loading || !loginCaptcha}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          <span>Entrando...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>Entrar no Sistema</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {allowSignup !== false && (
                  <TabsContent value="signup" className="mt-0 space-y-6">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                          Nome Completo
                        </Label>
                        <Input 
                          id="signup-name" 
                          name="fullName" 
                          required 
                          placeholder="Seu nome oficial" 
                          className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary shadow-inner"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                          Seu melhor e-mail
                        </Label>
                        <Input 
                          id="signup-email" 
                          name="email" 
                          type="email" 
                          required 
                          placeholder="seu@email.com" 
                          className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary shadow-inner"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                          Crie uma senha segura
                        </Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            name="password"
                            type={showSignupPass ? "text" : "password"}
                            required
                            placeholder="Mínimo 8 caracteres"
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary pr-12 shadow-inner"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignupPass(!showSignupPass)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showSignupPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <PasswordStrength password={signupPassword} />
                      </div>

                      <div className="pt-2">
                        <CaptchaCheckbox verified={signupCaptcha} onVerified={setSignupCaptcha} />
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl text-sm font-bold shadow-premium bg-primary hover:bg-primary/90 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" 
                        disabled={loading || !isPasswordValid || !signupCaptcha}
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            <span>Criando sua conta...</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <span>Finalizar Cadastro</span>
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8 text-xs text-muted-foreground font-medium"
        >
          © {new Date().getFullYear()} Ponto Pro. Todos os direitos reservados.
        </motion.p>
      </motion.div>

      <Dialog open={showForgot} onOpenChange={setShowForgot}>
        <DialogContent className="max-w-sm rounded-3xl border-none shadow-premium glass-card overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold">Recuperar Senha</DialogTitle>
            <DialogDescription className="font-medium">
              Informe seu e-mail para receber as instruções de redefinição.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setForgotLoading(true);
              const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
                redirectTo: `${window.location.origin}/reset-password`,
              });
              if (error) {
                toast.error(error.message);
              } else {
                toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
                setShowForgot(false);
              }
              setForgotLoading(false);
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                E-mail cadastrado
              </Label>
              <Input
                id="forgot-email"
                type="email"
                required
                placeholder="seu@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary shadow-inner"
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 shadow-md" disabled={forgotLoading}>
              {forgotLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white mx-auto" />
              ) : (
                "Enviar link de recuperação"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
