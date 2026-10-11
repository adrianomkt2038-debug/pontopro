import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

type Cargo = Tables<"cargos">;

export default function Cargos() {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cargo | null>(null);

  useEffect(() => {
    fetchCargos();
  }, []);

  const fetchCargos = async () => {
    setLoading(true);
    const { data } = await supabase.from("cargos").select("*").order("nome");
    setCargos(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = fd.get("nome") as string;
    const descricao = fd.get("descricao") as string;
    const nivel = parseInt(fd.get("nivel") as string) || 1;

    try {
      await invokeEntityAction("cargo_save", {
        id: editing?.id ?? null,
        nome,
        descricao,
        nivel,
      });

      toast.success(editing ? "Cargo atualizado!" : "Cargo criado!");
      setOpen(false);
      setEditing(null);
      fetchCargos();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar cargo");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invokeEntityAction("cargo_delete", { id });
      toast.success("Cargo removido!");
      fetchCargos();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover cargo");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cargos</h1>
          <p className="text-muted-foreground">Gerencie os cargos e funções da empresa</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Novo Cargo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Cargo" : "Novo Cargo"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" name="nome" required defaultValue={editing?.nome || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea id="descricao" name="descricao" defaultValue={editing?.descricao || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nivel">Nível</Label>
                <Input id="nivel" name="nivel" type="number" min={1} defaultValue={editing?.nivel || 1} />
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
            <Briefcase className="h-5 w-5" />
            Lista de Cargos ({cargos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : cargos.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum cargo cadastrado</TableCell></TableRow>
              ) : (
                cargos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.descricao || "—"}</TableCell>
                    <TableCell>{c.nivel}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
