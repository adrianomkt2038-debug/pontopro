import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download, RefreshCw, Search, Users, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "@/components/TablePagination";

interface RegistroComFuncionario {
  id: string;
  user_id: string;
  data: string;
  entrada: string | null;
  almoco_saida: string | null;
  almoco_retorno: string | null;
  saida: string | null;
  saldo_minutos: number | null;
  status: string;
  profile?: { full_name: string; matricula: string | null; avatar_url: string | null };
  cargo?: { nome: string } | null;
}

export default function Registros() {
  const { isAdmin, user } = useAuth();
  const [date, setDate] = useState(new Date());
  const [registros, setRegistros] = useState<RegistroComFuncionario[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [previewAvatar, setPreviewAvatar] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    fetchRegistros();
  }, [date]);

  const fetchRegistros = async () => {
    setLoading(true);
    const dateStr = format(date, "yyyy-MM-dd");

    // Fetch registros
    let query = supabase.from("registros_ponto").select("*").eq("data", dateStr);
    if (!isAdmin) {
      query = query.eq("user_id", user?.id || "");
    }
    const { data: regData } = await query;

    // Fetch profiles and funcionarios for names/cargos
    if (regData && regData.length > 0) {
      const userIds = regData.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, matricula, avatar_url").in("user_id", userIds);
      const { data: funcs } = await supabase.from("funcionarios").select("user_id, cargo_id, cargos(nome)").in("user_id", userIds);

      const enriched = regData.map((r) => ({
        ...r,
        profile: profiles?.find((p) => p.user_id === r.user_id),
        cargo: (funcs?.find((f) => f.user_id === r.user_id) as any)?.cargos,
      }));
      setRegistros(enriched);
    } else {
      setRegistros([]);
    }
    setLoading(false);
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "--:--";
    return format(new Date(ts), "HH:mm");
  };

  const formatSaldo = (mins: number | null) => {
    if (mins === null || mins === 0) return "--";
    const h = Math.floor(Math.abs(mins) / 60);
    const m = Math.abs(mins) % 60;
    const sign = mins < 0 ? "-" : "+";
    return `${sign}${h}h ${m.toString().padStart(2, "0")}m`;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      completo: { label: "Completo", variant: "default" },
      em_andamento: { label: "Em Andamento", variant: "secondary" },
      pendente: { label: "Não Registrou", variant: "destructive" },
      ausente: { label: "Ausente", variant: "destructive" },
      justificado: { label: "Justificado", variant: "outline" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const filteredRegistros = registros.filter((r) => {
    const matchesSearch = !search || r.profile?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "todos" || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    escalados: registros.length,
    presentes: registros.filter((r) => r.status === "completo").length,
    emAndamento: registros.filter((r) => r.status === "em_andamento").length,
    ausentes: registros.filter((r) => r.status === "pendente" || r.status === "ausente").length,
    taxa: registros.length > 0
      ? Math.round(((registros.filter((r) => r.status === "completo" || r.status === "em_andamento").length) / registros.length) * 100)
      : 0,
  };

  const dateStr = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Registros do Dia</h1>
          <p className="text-muted-foreground">Visão geral de todos os funcionários escalados no dia</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Date Navigation */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => setDate((d) => subDays(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase">Data</p>
            <p className="font-semibold capitalize">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>Hoje</Button>
            <Button variant="ghost" size="icon" onClick={() => setDate((d) => addDays(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchRegistros}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-5 w-5 text-info" /><div><p className="text-2xl font-bold">{stats.escalados}</p><p className="text-xs text-muted-foreground">Escalados</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><CheckCircle className="h-5 w-5 text-success" /><div><p className="text-2xl font-bold">{stats.presentes}</p><p className="text-xs text-muted-foreground">Presentes</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Clock className="h-5 w-5 text-info" /><div><p className="text-2xl font-bold">{stats.emAndamento}</p><p className="text-xs text-muted-foreground">Em Andamento</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><AlertTriangle className="h-5 w-5 text-destructive" /><div><p className="text-2xl font-bold">{stats.ausentes}</p><p className="text-xs text-muted-foreground">Ausentes</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div><p className="text-2xl font-bold">{stats.taxa}%</p><p className="text-xs text-muted-foreground">Taxa Presença</p></div></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Funcionários do Dia ({filteredRegistros.length} exibidos)</CardTitle>
          <div className="flex items-center gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="completo">Completo</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="ausente">Ausente</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar funcionário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-[200px]" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Almoço</TableHead>
                <TableHead>Retorno</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRegistros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {loading ? "Carregando..." : "Nenhum registro encontrado para esta data."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRegistros.slice((page - 1) * 10, page * 10).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          className={`h-8 w-8 ${r.profile?.avatar_url ? "cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 ring-offset-background transition-all" : ""}`}
                          onClick={() => r.profile?.avatar_url && setPreviewAvatar({ url: r.profile.avatar_url, name: r.profile.full_name })}
                        >
                          <AvatarImage src={r.profile?.avatar_url || undefined} alt={r.profile?.full_name} />
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {r.profile?.full_name?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{r.profile?.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{r.profile?.matricula || ""}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.cargo?.nome || "—"}</TableCell>
                    <TableCell className="text-sm">{formatTime(r.entrada)}</TableCell>
                    <TableCell className="text-sm">{formatTime(r.almoco_saida)}</TableCell>
                    <TableCell className="text-sm">{formatTime(r.almoco_retorno)}</TableCell>
                    <TableCell className="text-sm">{formatTime(r.saida)}</TableCell>
                    <TableCell className={`text-sm font-medium ${(r.saldo_minutos || 0) < 0 ? "text-destructive" : "text-success"}`}>
                      {formatSaldo(r.saldo_minutos)}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination currentPage={page} totalItems={filteredRegistros.length} pageSize={10} onPageChange={setPage} />
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
