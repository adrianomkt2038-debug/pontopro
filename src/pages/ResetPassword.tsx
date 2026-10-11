import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, Check, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Número", test: (p: string) => /\d/.test(p) },
  { label: "Caractere especial (!@#$%...)", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(p) },
];

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const isValid = useMemo(() => PASSWORD_RULES.every((r) => r.test(password)), [password]);

  useEffect(() => {
    // Supabase sets the session automatically from the recovery link hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Also check if already in recovery via hash
    if (window.location.hash.includes("type=recovery")) {
      setReady(true);
    }
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Senha atualizada com sucesso!");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const strength = password.length === 0 ? 0 : (passed / PASSWORD_RULES.length) * 100;
  const strengthLabel =
    strength <= 20 ? "Muito fraca" :
    strength <= 40 ? "Fraca" :
    strength <= 60 ? "Razoável" :
    strength <= 80 ? "Forte" : "Muito forte";
  const strengthColor =
    strength <= 20 ? "bg-destructive" :
    strength <= 40 ? "bg-warning" :
    strength <= 60 ? "bg-warning" :
    strength <= 80 ? "bg-success" : "bg-success";

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Timer className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Nova Senha</CardTitle>
          <CardDescription>
            {ready ? "Digite sua nova senha abaixo" : "Aguardando validação do link..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPass ? "text" : "password"}
                    required
                    placeholder="Crie uma senha forte"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Força da senha</span>
                      <span className={`font-medium ${strength >= 80 ? "text-success" : strength >= 60 ? "text-warning" : "text-destructive"}`}>
                        {strengthLabel}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${strengthColor}`} style={{ width: `${strength}%` }} />
                    </div>
                    <ul className="space-y-1">
                      {PASSWORD_RULES.map((rule) => {
                        const ok = rule.test(password);
                        return (
                          <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-success" : "text-muted-foreground"}`}>
                            {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {rule.label}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading || !isValid}>
                {loading ? "Atualizando..." : "Atualizar Senha"}
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
