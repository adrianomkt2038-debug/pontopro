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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CheckSquare, CheckCircle, XCircle, Plus, Search, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { TablePagination } from "@/components/TablePagination";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

const TIPOS = [
  { value: "hora_extra", label: "Hora Extra" },
  { value: "banco_horas", label: "Banco de Horas" },
  { value: "advertencia", label: "Advertência" },
  { value: "suspensao", label: "Suspensão" },
  { value: "elogio", label: "Elogio" },
  { value: "outros", label: "Outros" },
];

export default function Aprovacoes() {
  const { isAdmin, isGestor } = useAuth();
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [funcionarios, setFuncionarios] = useState<{ user_id: string; full_name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTipo, setSelectedTipo] = useState("");
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [tab, setTab] = useState("pendente");
  const [page, setPage] = useState(1);
  const [previewAvatar, setPreviewAvatar] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    fetchOcorrencias();
    if (isAdmin || isGestor) fetchFuncionarios();
  }, [isAdmin, isGestor]);

  const fetchFuncionarios = async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name").eq("active", true).order("full_name");
    setFuncionarios(data || []);
  };

  const fetchOcorrencias = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ocorrencias")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map((o) => o.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
        const enriched = data.map((o) => ({
          ...o,
          profile: profiles?.find((p) => p.user_id === o.user_id),
        }));
        setOcorrencias(enriched);
      } else {
        setOcorrencias([]);
      }
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error("Selecione o funcionário");
      return;
    }
    if (!selectedTipo) {
      toast.error("Selecione o tipo");
      return;
    }
    const fd = new FormData(e.currentTarget);
    try {
      await invokeEntityAction("ocorrencia_create", {
        user_id: selectedUserId,
        tipo: selectedTipo,
        descricao: fd.get("descricao") as string,
        data: fd.get("data") as string,
      });

      toast.success("Ocorrência criada!");
      setOpen(false);
      setSelectedUserId("");
      setSelectedTipo("");
      fetchOcorrencias();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar ocorrência");
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await invokeEntityAction("ocorrencia_decide", { id, approved });
      toast.success(approved ? "Ocorrência aprovada!" : "Ocorrência rejeitada!");
      fetchOcorrencias();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar ocorrência");
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

  const tipoLabel = (tipo: string) => TIPOS.find((t) => t.value === tipo)?.label || tipo;

  const filtered = ocorrencias.filter((o) => {
    const matchTab = o.status === tab;
    const matchSearch = !search || o.profile?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === "todos" || o.tipo === filterTipo;
    return matchTab && matchSearch && matchTipo;
  });

  const counts = {
    pendente: ocorrencias.filter((o) => o.status === "pendente").length,
    aprovada: ocorrencias.filter((o) => o.status === "aprovada").length,
    rejeitada: ocorrencias.filter((o) => o.status === "rejeitada").length,
  };

  const canManage = isAdmin || isGestor;

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
              {canManage && tab === "pendente" && <TableHead>Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma ocorrência encontrada</TableCell>
              </TableRow>
            ) : (
              paged.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        className={`h-8 w-8 ${o.profile?.avatar_url ? "cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 ring-offset-background transition-all" : ""}`}
                        onClick={() => o.profile?.avatar_url && setPreviewAvatar({ url: o.profile.avatar_url, name: o.profile.full_name })}
                      >
                        <AvatarImage src={o.profile?.avatar_url || undefined} alt={o.profile?.full_name} />
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {o.profile?.full_name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{o.profile?.full_name || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(o.data), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-sm">{tipoLabel(o.tipo)}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{o.descricao}</TableCell>
                  <TableCell>{statusBadge(o.status)}</TableCell>
                  {canManage && tab === "pendente" && (
                    <TableCell>
                      {o.status === "pendente" && (
                        <div className="flex gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <CheckCircle className="h-4 w-4 text-success" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Aprovar ocorrência?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  A ocorrência de "{o.profile?.full_name}" ({tipoLabel(o.tipo)}) será aprovada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleApprove(o.id, true)}>Aprovar</AlertDialogAction>
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
                                <AlertDialogTitle>Rejeitar ocorrência?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  A ocorrência de "{o.profile?.full_name}" ({tipoLabel(o.tipo)}) será rejeitada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleApprove(o.id, false)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Rejeitar
                                </AlertDialogAction>
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
          <h1 className="text-2xl font-bold">Ocorrências</h1>
          <p className="text-muted-foreground">Ocorrências e edições pendentes de aprovação</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Ocorrência
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Ocorrência</DialogTitle>
                <DialogDescription>Crie uma ocorrência e atribua a um funcionário.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Funcionário</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
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
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input name="data" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea name="descricao" required placeholder="Descreva a ocorrência..." />
                </div>
                <DialogFooter>
                  <Button type="submit">Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
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
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
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
            <TabsContent value="pendente" className="m-0">
              {renderTable(filtered)}
            </TabsContent>
            <TabsContent value="aprovada" className="m-0">
              {renderTable(filtered)}
            </TabsContent>
            <TabsContent value="rejeitada" className="m-0">
              {renderTable(filtered)}
            </TabsContent>
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
