import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UserCircle, Save, KeyRound, Check, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Número", test: (p: string) => /\d/.test(p) },
  { label: "Caractere especial (!@#$%...)", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(p) },
];

export default function Perfil() {
  const { user, profile, roles } = useAuth();
  const [fullName, setFullName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [loading, setSaving] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setMatricula(profile.matricula || "");
    }
  }, [profile]);

  const roleName = roles.includes("admin")
    ? "Administrador"
    : roles.includes("gestor")
    ? "Gestor"
    : "Colaborador";

  const initials = fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  const handleSave = async () => {
    if (!user) return;
    if (fullName.trim().length < 2) {
      toast.error("Nome deve ter pelo menos 2 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await invokeEntityAction("profile_update_self", {
        full_name: fullName.trim(),
      });
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar perfil.");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Conta</p>
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>Atualize seus dados de perfil</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar
              className={`h-16 w-16 ${profile?.avatar_url ? "cursor-pointer ring-offset-background transition-all hover:ring-2 hover:ring-primary hover:ring-offset-2" : ""}`}
              onClick={() => profile?.avatar_url && setAvatarOpen(true)}
            >
              <AvatarImage src={profile?.avatar_url || undefined} alt={fullName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{fullName || "—"}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{roleName}</p>
            </div>
          </div>

          {/* Avatar preview dialog */}
          <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
            <DialogContent className="max-w-sm p-2 bg-background">
              <img
                src={profile?.avatar_url || ""}
                alt={fullName}
                className="w-full h-auto rounded-lg object-contain"
              />
            </DialogContent>
          </Dialog>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input value={matricula} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">A matrícula não pode ser alterada.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={profile?.email || ""} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
          </div>

          <Button onClick={handleSave} disabled={loading} className="gap-2">
            <Save className="h-4 w-4" />
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const isValid = useMemo(() => PASSWORD_RULES.every((r) => r.test(newPassword)), [newPassword]);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const passed = PASSWORD_RULES.filter((r) => r.test(newPassword)).length;
  const strength = newPassword.length === 0 ? 0 : (passed / PASSWORD_RULES.length) * 100;
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

  const handleChangePassword = async () => {
    if (!isValid) {
      toast.error("A senha não atende todos os requisitos.");
      return;
    }
    if (!passwordsMatch) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          Alterar Senha
        </CardTitle>
        <CardDescription>Defina uma nova senha para sua conta</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">Nova Senha</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNew ? "text" : "password"}
              placeholder="Crie uma senha forte"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10"
              maxLength={128}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPassword.length > 0 && (
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
                  const ok = rule.test(newPassword);
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

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-10"
              maxLength={128}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-destructive">As senhas não coincidem.</p>
          )}
        </div>

        <Button onClick={handleChangePassword} disabled={saving || !isValid || !passwordsMatch} className="gap-2">
          <KeyRound className="h-4 w-4" />
          {saving ? "Alterando..." : "Alterar Senha"}
        </Button>
      </CardContent>
    </Card>
  );
}
