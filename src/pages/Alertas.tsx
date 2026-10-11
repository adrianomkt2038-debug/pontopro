import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Bell, CheckCircle, Clock, Search, RefreshCw } from "lucide-react";
import { TablePagination } from "@/components/TablePagination";

interface AlertaRecord {
  id: string;
  user_id: string;
  data: string;
  tipo: string;
  descricao: string;
  status: string;
  created_at: string;
  profile?: { full_name: string; matricula: string | null; avatar_url: string | null };
}

export default function Alertas() {
  const { isAdmin, user } = useAuth();
  const [alertas, setAlertas] = useState<AlertaRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [tab, setTab] = useState("pendente");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [previewAvatar, setPreviewAvatar] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    fetchAlertas();
  }, [user]);

  const fetchAlertas = async () => {
    setLoading(true);
    let query = supabase
      .from("ocorrencias")
      .select("*")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("user_id", user?.id || "");
    }

    const { data } = await query;

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((a: any) => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, matricula, avatar_url")
        .in("user_id", userIds);

      const enriched = data.map((a: any) => ({
        ...a,
        profile: profiles?.find((p: any) => p.user_id === a.user_id),
      }));
      setAlertas(enriched);
    } else {
      setAlertas([]);
    }
    setLoading(false);
  };

  const tipoBadge = (tipo: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      jornada_incompleta: { label: "Jornada Incompleta", variant: "destructive" },
      atraso: { label: "Atraso", variant: "secondary" },
      falta: { label: "Falta", variant: "destructive" },
      advertencia: { label: "Advertência", variant: "outline" },
    };
    const t = map[tipo] || { label: tipo, variant: "outline" as const };
    return <Badge variant={t.variant}>{t.label}</Badge>;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pendente: { label: "Pendente", variant: "secondary" },
      aprovado: { label: "Resolvido", variant: "default" },
      rejeitado: { label: "Rejeitado", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const filtered = alertas.filter((a) => {
    const matchTab = a.status === tab;
    const matchSearch = !search || a.profile?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === "todos" || a.tipo === filterTipo;
    return matchTab && matchSearch && matchTipo;
  });

  const counts = {
    pendente: alertas.filter((a) => a.status === "pendente").length,
    aprovado: alertas.filter((a) => a.status === "aprovado").length,
    rejeitado: alertas.filter((a) => a.status === "rejeitado").length,
  };

  const jornadaIncompleta = alertas.filter((a) => a.tipo === "jornada_incompleta").length;
  const outros = alertas.filter((a) => a.tipo !== "jornada_incompleta").length;

  const renderTable = (items: AlertaRecord[]) => {
    const paged = items.slice((page - 1) * 10, page * 10);
    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Funcionário</TableHead>}
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                  {loading ? "Carregando..." : "Nenhum alerta encontrado."}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((a) => (
                <TableRow key={a.id}>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          className={`h-8 w-8 ${a.profile?.avatar_url ? "cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 ring-offset-background transition-all" : ""}`}
                          onClick={() => a.profile?.avatar_url && setPreviewAvatar({ url: a.profile.avatar_url, name: a.profile.full_name })}
                        >
                          <AvatarImage src={a.profile?.avatar_url || undefined} alt={a.profile?.full_name} />
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {a.profile?.full_name?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{a.profile?.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{a.profile?.matricula || ""}</p>
                        </div>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-sm">
                    {format(new Date(a.data + "T12:00:00"), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>{tipoBadge(a.tipo)}</TableCell>
                  <TableCell className="text-sm max-w-[300px] truncate">{a.descricao}</TableCell>
                  <TableCell>{statusBadge(a.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(a.created_at), "dd/MM HH:mm")}
                  </TableCell>
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
          <p className="text-sm text-muted-foreground">{isAdmin ? "Admin" : "Colaborador"} &gt; Alertas</p>
          <h1 className="text-2xl font-bold">Alertas</h1>
          <p className="text-muted-foreground">Ocorrências e notificações automáticas do sistema</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchAlertas}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Bell className="h-5 w-5 text-warning" />
            <div>
              <p className="text-2xl font-bold">{counts.pendente}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{jornadaIncompleta}</p>
              <p className="text-xs text-muted-foreground">Jornada Incompleta</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-5 w-5 text-success" />
            <div>
              <p className="text-2xl font-bold">{counts.aprovado}</p>
              <p className="text-xs text-muted-foreground">Resolvidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-info" />
            <div>
              <p className="text-2xl font-bold">{outros}</p>
              <p className="text-xs text-muted-foreground">Outras Ocorrências</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Lista de Alertas</CardTitle>
          <div className="flex items-center gap-3">
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="jornada_incompleta">Jornada Incompleta</SelectItem>
                <SelectItem value="atraso">Atraso</SelectItem>
                <SelectItem value="falta">Falta</SelectItem>
                <SelectItem value="advertencia">Advertência</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-[180px]" />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="px-6">
              <TabsList>
                <TabsTrigger value="pendente">Pendentes ({counts.pendente})</TabsTrigger>
                <TabsTrigger value="aprovado">Resolvidos ({counts.aprovado})</TabsTrigger>
                <TabsTrigger value="rejeitado">Rejeitados ({counts.rejeitado})</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="pendente" className="mt-0">{renderTable(filtered)}</TabsContent>
            <TabsContent value="aprovado" className="mt-0">{renderTable(filtered)}</TabsContent>
            <TabsContent value="rejeitado" className="mt-0">{renderTable(filtered)}</TabsContent>
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
