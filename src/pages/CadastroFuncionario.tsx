import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { UserPlus, Briefcase, CalendarClock, ArrowLeft, Loader2 } from "lucide-react";
import { FaceRegistration } from "@/components/FaceRegistration";
import { z } from "zod";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

const funcionarioSchema = z.object({
  full_name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().trim().email("E-mail inválido").max(255, "E-mail muito longo"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  matricula: z.string().trim().min(1, "Matrícula é obrigatória").max(20, "Matrícula muito longa"),
  cargo_id: z.string().uuid("Selecione um cargo").optional().or(z.literal("")),
  escala_id: z.string().uuid("Selecione uma escala").optional().or(z.literal("")),
  data_admissao: z.string().min(1, "Data de admissão é obrigatória"),
});

type FormData = z.infer<typeof funcionarioSchema>;

export default function CadastroFuncionario() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [cargos, setCargos] = useState<{ id: string; nome: string }[]>([]);
  const [escalas, setEscalas] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [form, setForm] = useState<FormData>({
    full_name: "",
    email: "",
    password: "",
    matricula: "",
    cargo_id: "",
    escala_id: "",
    data_admissao: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    async function loadData() {
      const [cargosRes, escalasRes] = await Promise.all([
        supabase.from("cargos").select("id, nome").order("nome"),
        supabase.from("escalas").select("id, nome").order("nome"),
      ]);
      setCargos(cargosRes.data || []);
      setEscalas(escalasRes.data || []);
    }
    loadData();
  }, []);

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = funcionarioSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof FormData;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      const created = await invokeEntityAction<{ user_id: string }>("admin_create_funcionario", {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        matricula: form.matricula,
        cargo_id: form.cargo_id || null,
        escala_id: form.escala_id || null,
        data_admissao: form.data_admissao,
      });

      const userId = created.user_id;
      setNewUserId(userId);
      setNewUserName(form.full_name);

      toast({
        title: "Funcionário cadastrado!",
        description: `${form.full_name} foi cadastrado com sucesso. Agora você pode cadastrar a face.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao cadastrar",
        description: err?.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/usuarios")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Cadastrar Funcionário</h1>
          <p className="text-muted-foreground">Preencha os dados para registrar um novo funcionário</p>
        </div>
      </div>

      {newUserId ? (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-3">
              <UserPlus className="h-8 w-8 text-emerald-600" />
            </div>
            <CardTitle>Funcionário Cadastrado!</CardTitle>
            <CardDescription>
              {newUserName} foi registrado com sucesso. Deseja cadastrar o reconhecimento facial?
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <FaceRegistration userId={newUserId} userName={newUserName} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setNewUserId(null); setNewUserName(""); setForm({ full_name: "", email: "", password: "", matricula: "", cargo_id: "", escala_id: "", data_admissao: new Date().toISOString().split("T")[0] }); }}>
                Cadastrar Outro
              </Button>
              <Button onClick={() => navigate("/usuarios")}>
                Ver Usuários
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5" />
                Dados Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input id="full_name" value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} placeholder="Nome do funcionário" />
                  {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@empresa.com" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha Inicial *</Label>
                  <Input id="password" type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} placeholder="Mínimo 8 caracteres" />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matricula">Matrícula *</Label>
                  <Input id="matricula" value={form.matricula} onChange={(e) => updateField("matricula", e.target.value)} placeholder="Ex: 00123" />
                  {errors.matricula && <p className="text-xs text-destructive">{errors.matricula}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                Dados Funcionais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select value={form.cargo_id} onValueChange={(v) => updateField("cargo_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Escala</Label>
                  <Select value={form.escala_id} onValueChange={(v) => updateField("escala_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a escala" />
                    </SelectTrigger>
                    <SelectContent>
                      {escalas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_admissao">Data de Admissão *</Label>
                <Input id="data_admissao" type="date" value={form.data_admissao} onChange={(e) => updateField("data_admissao", e.target.value)} />
                {errors.data_admissao && <p className="text-xs text-destructive">{errors.data_admissao}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="outline" onClick={() => navigate("/usuarios")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading ? "Cadastrando..." : "Cadastrar Funcionário"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
