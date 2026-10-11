import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

const BATIDAS_PADRAO = [
  { key: "entrada", label: "Entrada" },
  { key: "almoco_saida", label: "Saída Almoço" },
  { key: "almoco_retorno", label: "Retorno Almoço" },
  { key: "saida", label: "Saída" },
];

const BATIDAS_EXTRAS = [
  { key: "intervalo_1_saida", label: "Intervalo 1 - Saída" },
  { key: "intervalo_1_retorno", label: "Intervalo 1 - Retorno" },
  { key: "intervalo_2_saida", label: "Intervalo 2 - Saída" },
  { key: "intervalo_2_retorno", label: "Intervalo 2 - Retorno" },
];

const ALL_BATIDAS = [...BATIDAS_PADRAO, ...BATIDAS_EXTRAS];

interface TipoRegistro {
  id: string;
  nome: string;
  descricao: string | null;
  batidas: string[];
  created_at: string;
}

export default function TiposRegistro() {
  const { isAdmin } = useAuth();
  const [tipos, setTipos] = useState<TipoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TipoRegistro | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [batidasSelecionadas, setBatidasSelecionadas] = useState<string[]>(["entrada", "almoco_saida", "almoco_retorno", "saida"]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTipos();
  }, []);

  const fetchTipos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tipos_registro").select("*").order("created_at");
    if (error) {
      toast.error("Erro ao carregar tipos de registro");
    } else {
      setTipos((data as TipoRegistro[]) || []);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setNome("");
    setDescricao("");
    setBatidasSelecionadas(["entrada", "almoco_saida", "almoco_retorno", "saida"]);
    setDialogOpen(true);
  };

  const openEdit = (tipo: TipoRegistro) => {
    setEditing(tipo);
    setNome(tipo.nome);
    setDescricao(tipo.descricao || "");
    setBatidasSelecionadas(tipo.batidas);
    setDialogOpen(true);
  };

  const toggleBatida = (key: string) => {
    setBatidasSelecionadas((prev) =>
      prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (batidasSelecionadas.length === 0) {
      toast.error("Selecione pelo menos uma batida");
      return;
    }

    setSaving(true);
    // Maintain order
    const ordered = ALL_BATIDAS.filter((b) => batidasSelecionadas.includes(b.key)).map((b) => b.key);

    try {
      await invokeEntityAction("tipo_registro_save", {
        id: editing?.id ?? null,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        batidas: ordered,
      });

      toast.success(editing ? "Tipo atualizado" : "Tipo criado");
      setDialogOpen(false);
      fetchTipos();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar tipo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invokeEntityAction("tipo_registro_delete", { id });
      toast.success("Tipo excluído");
      fetchTipos();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir. Verifique se há escalas vinculadas.");
    }
  };

  const batidaLabel = (key: string) => ALL_BATIDAS.find((b) => b.key === key)?.label || key;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tipos de Registro</h1>
          <p className="text-muted-foreground">Configure quais batidas cada escala utiliza</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Tipo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Tipos Cadastrados ({tipos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Batidas</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : tipos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum tipo cadastrado.</TableCell>
                </TableRow>
              ) : (
                tipos.map((tipo) => (
                  <TableRow key={tipo.id}>
                    <TableCell className="font-medium">{tipo.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tipo.descricao || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tipo.batidas.map((b) => (
                          <Badge key={b} variant="secondary" className="text-xs">{batidaLabel(b)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(tipo)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir tipo de registro?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita. O tipo "{tipo.nome}" será removido. Escalas vinculadas perderão a referência.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(tipo.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tipo" : "Novo Tipo de Registro"}</DialogTitle>
            <DialogDescription>Configure o nome e as batidas que compõem este tipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Padrão, Meio Período..." />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do tipo..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Batidas Padrão</Label>
              <div className="grid grid-cols-2 gap-2">
                {BATIDAS_PADRAO.map((b) => (
                  <label key={b.key} className="flex items-center gap-2 cursor-pointer rounded-lg border p-2.5 has-[[data-state=checked]]:bg-accent transition-colors">
                    <Checkbox
                      checked={batidasSelecionadas.includes(b.key)}
                      onCheckedChange={() => toggleBatida(b.key)}
                    />
                    <span className="text-sm">{b.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Batidas Extras (opcional)</Label>
              <div className="grid grid-cols-2 gap-2">
                {BATIDAS_EXTRAS.map((b) => (
                  <label key={b.key} className="flex items-center gap-2 cursor-pointer rounded-lg border p-2.5 has-[[data-state=checked]]:bg-accent transition-colors">
                    <Checkbox
                      checked={batidasSelecionadas.includes(b.key)}
                      onCheckedChange={() => toggleBatida(b.key)}
                    />
                    <span className="text-sm">{b.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
