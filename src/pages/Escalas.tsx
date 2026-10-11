import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

type Escala = Tables<"escalas">;

interface TipoRegistro {
  id: string;
  nome: string;
  batidas: string[];
}

const DIAS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

export default function Escalas() {
  const [escalas, setEscalas] = useState<(Escala & { tipos_registro?: TipoRegistro | null })[]>([]);
  const [tiposRegistro, setTiposRegistro] = useState<TipoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Escala | null>(null);
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([1, 2, 3, 4, 5]);
  const [tipoRegistroId, setTipoRegistroId] = useState<string>("");

  useEffect(() => {
    fetchEscalas();
    fetchTiposRegistro();
  }, []);

  const fetchTiposRegistro = async () => {
    const { data } = await supabase.from("tipos_registro").select("id, nome, batidas").order("nome");
    setTiposRegistro((data as TipoRegistro[]) || []);
  };

  const fetchEscalas = async () => {
    setLoading(true);
    const { data } = await supabase.from("escalas").select("*, tipos_registro(id, nome, batidas)").order("nome");
    setEscalas(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: fd.get("nome") as string,
      descricao: fd.get("descricao") as string,
      hora_entrada: fd.get("hora_entrada") as string,
      hora_saida: fd.get("hora_saida") as string,
      hora_almoco_inicio: fd.get("hora_almoco_inicio") as string,
      hora_almoco_fim: fd.get("hora_almoco_fim") as string,
      dias_semana: diasSelecionados,
      tipo_registro_id: tipoRegistroId && tipoRegistroId !== "none" ? tipoRegistroId : null,
    };

    try {
      await invokeEntityAction("escala_save", {
        id: editing?.id ?? null,
        ...payload,
      });

      toast.success(editing ? "Escala atualizada!" : "Escala criada!");
      setOpen(false);
      setEditing(null);
      fetchEscalas();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar escala");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invokeEntityAction("escala_delete", { id });
      toast.success("Escala removida!");
      fetchEscalas();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover escala");
    }
  };

  const diasLabel = (dias: number[]) =>
    DIAS.filter((d) => dias.includes(d.value)).map((d) => d.label).join(", ");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Escalas</h1>
          <p className="text-muted-foreground">Gerencie as escalas e horários de trabalho</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nova Escala</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Escala" : "Nova Escala"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input name="nome" required defaultValue={editing?.nome || ""} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea name="descricao" defaultValue={editing?.descricao || ""} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entrada</Label>
                  <Input name="hora_entrada" type="time" defaultValue={editing?.hora_entrada || "08:00"} />
                </div>
                <div className="space-y-2">
                  <Label>Saída</Label>
                  <Input name="hora_saida" type="time" defaultValue={editing?.hora_saida || "17:00"} />
                </div>
                <div className="space-y-2">
                  <Label>Almoço Início</Label>
                  <Input name="hora_almoco_inicio" type="time" defaultValue={editing?.hora_almoco_inicio || "12:00"} />
                </div>
                <div className="space-y-2">
                  <Label>Almoço Fim</Label>
                  <Input name="hora_almoco_fim" type="time" defaultValue={editing?.hora_almoco_fim || "13:00"} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dias da Semana</Label>
                <div className="flex flex-wrap gap-3">
                  {DIAS.map((d) => (
                    <label key={d.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={diasSelecionados.includes(d.value)}
                        onCheckedChange={(checked) => {
                          setDiasSelecionados((prev) =>
                            checked ? [...prev, d.value] : prev.filter((v) => v !== d.value)
                          );
                        }}
                      />
                      {d.label}
                    </label>
                  ))}
              </div>
              <div className="space-y-2">
                <Label>Tipo de Registro</Label>
                <Select value={tipoRegistroId} onValueChange={setTipoRegistroId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de registro..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {tiposRegistro.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              </div>
              <DialogFooter>
                <Button type="submit">{editing ? "Salvar" : "Criar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Escalas Cadastradas ({escalas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Almoço</TableHead>
                <TableHead>Tipo Registro</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : escalas.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma escala cadastrada</TableCell></TableRow>
              ) : (
                escalas.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.nome}</TableCell>
                    <TableCell className="text-sm">{e.hora_entrada} - {e.hora_saida}</TableCell>
                    <TableCell className="text-sm">{e.hora_almoco_inicio} - {e.hora_almoco_fim}</TableCell>
                    <TableCell>
                      {(e as any).tipos_registro ? (
                        <Badge variant="secondary">{(e as any).tipos_registro.nome}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{diasLabel(e.dias_semana)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setDiasSelecionados(e.dias_semana); setTipoRegistroId((e as any).tipo_registro_id || ""); setOpen(true); }}>
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
                              <AlertDialogTitle>Excluir escala?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita. A escala "{e.nome}" será removida permanentemente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(e.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
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
    </div>
  );
}
