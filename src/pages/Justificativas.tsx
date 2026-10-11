import { useEffect, useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, FileText, CheckCircle, XCircle, Search, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { TablePagination } from "@/components/TablePagination";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

export default function Justificativas() {
  const { user, isAdmin } = useAuth();
  const [justificativas, setJustificativas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [funcionarios, setFuncionarios] = useState<{ user_id: string; full_name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [tab, setTab] = useState("pendente");
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [page, setPage] = useState(1);
  const [previewAvatar, setPreviewAvatar] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    fetchJustificativas();
    if (isAdmin) fetchFuncionarios();
  }, [isAdmin]);

  const fetchFuncionarios = async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name").eq("active", true).order("full_name");
    setFuncionarios(data || []);
  };

  const fetchJustificativas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("justificativas")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map((j) => j.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      const enriched = data.map((j) => ({
        ...j,
        profile: profiles?.find((p) => p.user_id === j.user_id),
      }));
      setJustificativas(enriched);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const targetUserId = isAdmin && selectedUserId ? selectedUserId : user!.id;

    try {
      await invokeEntityAction("justificativa_create", {
        user_id: targetUserId,
        data: fd.get("data") as string,
        tipo: fd.get("tipo") as string,
        descricao: fd.get("descricao") as string,
      });

      toast.success("Justificativa enviada!");
      setOpen(false);
      setSelectedUserId("");
      fetchJustificativas();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar justificativa");
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await invokeEntityAction("justificativa_decide", { id, approved });
      toast.success(approved ? "Justificativa aprovada!" : "Justificativa rejeitada!");
      fetchJustificativas();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar justificativa");
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pendente: { label: "Pendente", variant: "secondary" },
      aprovada: { label: "Aprovada", variant: "default" },
      rejeitada: { label: "Rejeitada", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const tipoLabel: Record<string, string> = {
    falta: "Falta",
    atraso: "Atraso",
    saida_antecipada: "Saída Antecipada",
    atestado: "Atestado",
    outros: "Outros",
  };

  const filtered = justificativas.filter((j) => {
    const matchTab = j.status === tab;
    const matchSearch = !search || j.profile?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === "todos" || j.tipo === filterTipo;
    return matchTab && matchSearch && matchTipo;
  });

  const counts = {
    pendente: justificativas.filter((j) => j.status === "pendente").length,
    aprovada: justificativas.filter((j) => j.status === "aprovada").length,
    rejeitada: justificativas.filter((j) => j.status === "rejeitada").length,
  };

  const renderTable = (items: any[]) => {
    const paged = items.slice((page - 1) * 10, page * 10);
    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && tab === "pendente" && <TableHead>Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma justificativa encontrada</TableCell></TableRow>
            ) : (
              paged.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        className={`h-8 w-8 ${j.profile?.avatar_url ? "cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 ring-offset-background transition-all" : ""}`}
                        onClick={() => j.profile?.avatar_url && setPreviewAvatar({ url: j.profile.avatar_url, name: j.profile.full_name })}
                      >
                        <AvatarImage src={j.profile?.avatar_url || undefined} alt={j.profile?.full_name} />
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {j.profile?.full_name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{j.profile?.full_name || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(j.data), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-sm">{tipoLabel[j.tipo] || j.tipo}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{j.descricao}</TableCell>
                  <TableCell>{statusBadge(j.status)}</TableCell>
                  {isAdmin && tab === "pendente" && (
                    <TableCell>
                      {j.status === "pendente" && (
                        <div className="flex gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <CheckCircle className="h-4 w-4 text-success" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Aprovar justificativa?</AlertDialogTitle>
                                <AlertDialogDescription>A justificativa de "{j.profile?.full_name}" será marcada como aprovada.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleApprove(j.id, true)}>Aprovar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Rejeitar justificativa?</AlertDialogTitle>
                                <AlertDialogDescription>A justificativa de "{j.profile?.full_name}" será marcada como rejeitada.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleApprove(j.id, false)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Rejeitar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination currentPage={page} totalItems={items.length} pageSize={10} onPageChange={setPage} />
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Justificativas</h1>
          <p className="text-muted-foreground">Atestados, faltas e justificativas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nova Justificativa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Justificativa</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Funcionário</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o funcionário..." />
                    </SelectTrigger>
                    <SelectContent>
                      {funcionarios.map((f) => (
                        <SelectItem key={f.user_id} value={f.user_id}>{f.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Data</Label>
                <Input name="data" type="date" required />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select name="tipo" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="falta">Falta</option>
                  <option value="atraso">Atraso</option>
                  <option value="saida_antecipada">Saída Antecipada</option>
                  <option value="atestado">Atestado</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea name="descricao" required placeholder="Descreva o motivo..." />
              </div>
              <DialogFooter><Button type="submit">Enviar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{counts.pendente}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-5 w-5 text-success" />
            <div>
              <p className="text-2xl font-bold">{counts.aprovada}</p>
              <p className="text-xs text-muted-foreground">Aprovadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{counts.rejeitada}</p>
              <p className="text-xs text-muted-foreground">Rejeitadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="falta">Falta</SelectItem>
            <SelectItem value="atraso">Atraso</SelectItem>
            <SelectItem value="saida_antecipada">Saída Antecipada</SelectItem>
            <SelectItem value="atestado">Atestado</SelectItem>
            <SelectItem value="outros">Outros</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="border-b px-4 pt-3">
              <TabsList className="bg-transparent h-auto p-0 gap-4">
                <TabsTrigger value="pendente" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-2">
                  Pendentes ({counts.pendente})
                </TabsTrigger>
                <TabsTrigger value="aprovada" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-2">
                  Aprovadas ({counts.aprovada})
                </TabsTrigger>
                <TabsTrigger value="rejeitada" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-2">
                  Rejeitadas ({counts.rejeitada})
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="pendente" className="m-0">{renderTable(filtered)}</TabsContent>
            <TabsContent value="aprovada" className="m-0">{renderTable(filtered)}</TabsContent>
            <TabsContent value="rejeitada" className="m-0">{renderTable(filtered)}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Avatar Preview Dialog */}
      <Dialog open={!!previewAvatar} onOpenChange={(open) => !open && setPreviewAvatar(null)}>
        <DialogContent className="max-w-sm p-2 bg-background">
          {previewAvatar && (
            <img src={previewAvatar.url} alt={previewAvatar.name} className="w-full h-auto rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
