import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays } from "date-fns";
import { Clock, TrendingUp, TrendingDown, Settings, RefreshCw, Search, Calculator, Download } from "lucide-react";
import { toast } from "sonner";
import { TablePagination, usePagination } from "@/components/TablePagination";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

interface BancoHorasRecord {
  id: string;
  user_id: string;
  data: string;
  minutos_trabalhados: number;
  minutos_esperados: number;
  saldo_minutos: number;
  tipo: string;
  profile?: { full_name: string; matricula: string | null; avatar_url: string | null };
}

interface ProfileOption {
  user_id: string;
  full_name: string;
}

export default function BancoHoras() {
  const { isAdmin, user } = useAuth();
  const [records, setRecords] = useState<BancoHorasRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterUser, setFilterUser] = useState("todos");
  const [periodo, setPeriodo] = useState("7");
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [toleranciaBH, setToleranciaBH] = useState(10);
  const [toleranciaJI, setToleranciaJI] = useState(10);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [employees, setEmployees] = useState<ProfileOption[]>([]);
  const [page, setPage] = useState(1);
  const [previewAvatar, setPreviewAvatar] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    fetchRecords();
    fetchTolerances();
    if (isAdmin) fetchEmployees();
  }, [periodo, user, isAdmin]);

  const fetchEmployees = async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name").eq("active", true).order("full_name");
    setEmployees(data || []);
  };

  const fetchTolerances = async () => {
    const { data } = await supabase.from("configuracoes_ponto").select("chave, valor");
    if (data) {
      const bh = data.find((c: any) => c.chave === "tolerancia_banco_horas");
      const ji = data.find((c: any) => c.chave === "tolerancia_jornada_incompleta");
      if (bh) setToleranciaBH(bh.valor);
      if (ji) setToleranciaJI(ji.valor);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    const numDays = parseInt(periodo);
    const startDate = format(subDays(new Date(), numDays - 1), "yyyy-MM-dd");
    const endDate = format(new Date(), "yyyy-MM-dd");

    let query = supabase
      .from("banco_horas")
      .select("*")
      .gte("data", startDate)
      .lte("data", endDate)
      .order("data", { ascending: false });

    if (!isAdmin) {
      query = query.eq("user_id", user?.id || "");
    }

    const { data: bhData } = await query;

    if (bhData && bhData.length > 0) {
      const userIds = [...new Set(bhData.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, matricula, avatar_url").in("user_id", userIds);

      const enriched = bhData.map((r: any) => ({
        ...r,
        profile: profiles?.find((p: any) => p.user_id === r.user_id),
      }));
      setRecords(enriched);
    } else {
      setRecords([]);
    }
    setLoading(false);
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase.functions.invoke("calcular-banco-horas", {
        body: { data: today },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(`Banco de horas calculado: ${data.data.processed} registros processados`);
        fetchRecords();
      } else {
        toast.error(data?.error || "Erro ao calcular");
      }
    } catch (err: any) {
      toast.error("Erro ao calcular banco de horas");
      console.error(err);
    }
    setCalculating(false);
  };

  const handleSaveTolerances = async () => {
    try {
      await invokeEntityAction("configuracoes_ponto_update", {
        tolerancia_banco_horas: toleranciaBH,
        tolerancia_jornada_incompleta: toleranciaJI,
      });
      toast.success("Tolerâncias atualizadas com sucesso");
      setSettingsOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar tolerâncias");
    }
  };

  const formatMinutos = (mins: number) => {
    const h = Math.floor(Math.abs(mins) / 60);
    const m = Math.abs(mins) % 60;
    const sign = mins < 0 ? "-" : "+";
    return mins === 0 ? "0h" : `${sign}${h}h${m.toString().padStart(2, "0")}min`;
  };

  const handleExportCSV = () => {
    const dataToExport = filtered.length > 0 ? filtered : records;
    if (dataToExport.length === 0) { toast.error("Nenhum registro para exportar"); return; }

    const tipoLabel = (t: string) => {
      const m: Record<string, string> = { hora_extra: "Hora Extra", jornada_incompleta: "Jornada Incompleta", normal: "Normal" };
      return m[t] || t;
    };

    const header = "Funcionário;Data;Trabalhado;Esperado;Saldo;Tipo\n";
    const rows = dataToExport.map((r) =>
      `${r.profile?.full_name || "—"};${format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy")};${formatMinutos(r.minutos_trabalhados).replace("+", "")};${formatMinutos(r.minutos_esperados).replace("+", "")};${formatMinutos(r.saldo_minutos)};${tipoLabel(r.tipo)}`
    ).join("\n");

    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `banco_horas_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação CSV realizada com sucesso");
  };

  const handleExportPDF = () => {
    const dataToExport = filtered.length > 0 ? filtered : records;
    if (dataToExport.length === 0) { toast.error("Nenhum registro para exportar"); return; }

    const tipoLabel = (t: string) => {
      const m: Record<string, string> = { hora_extra: "Hora Extra", jornada_incompleta: "Jornada Incompleta", normal: "Normal" };
      return m[t] || t;
    };

    const tableRows = dataToExport.map((r) => `
      <tr>
        <td>${r.profile?.full_name || "—"}</td>
        <td>${format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy")}</td>
        <td>${formatMinutos(r.minutos_trabalhados).replace("+", "")}</td>
        <td>${formatMinutos(r.minutos_esperados).replace("+", "")}</td>
        <td style="color:${r.saldo_minutos >= 0 ? "#16a34a" : "#dc2626"};font-weight:600">${formatMinutos(r.saldo_minutos)}</td>
        <td>${tipoLabel(r.tipo)}</td>
      </tr>
    `).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Pop-up bloqueado pelo navegador"); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Banco de Horas</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#1a1a1a}
      h1{font-size:20px;margin-bottom:4px}
      .subtitle{color:#666;font-size:13px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#f3f4f6;text-align:left;padding:8px 10px;border-bottom:2px solid #d1d5db;font-weight:600}
      td{padding:7px 10px;border-bottom:1px solid #e5e7eb}
      tr:nth-child(even){background:#f9fafb}
      .footer{margin-top:24px;font-size:11px;color:#999;text-align:center}
    </style></head><body>
      <h1>Relatório de Banco de Horas</h1>
      <p class="subtitle">Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
      <table><thead><tr><th>Funcionário</th><th>Data</th><th>Trabalhado</th><th>Esperado</th><th>Saldo</th><th>Tipo</th></tr></thead>
      <tbody>${tableRows}</tbody></table>
      <p class="footer">Controle de Ponto Pro — Documento gerado automaticamente</p>
    </body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
    toast.success("PDF gerado — use 'Salvar como PDF' na janela de impressão");
  };

  const tipoBadge = (tipo: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      hora_extra: { label: "Hora Extra", variant: "default" },
      jornada_incompleta: { label: "Jornada Incompleta", variant: "destructive" },
      normal: { label: "Normal", variant: "secondary" },
    };
    const t = map[tipo] || { label: tipo, variant: "outline" as const };
    return <Badge variant={t.variant}>{t.label}</Badge>;
  };

  const userScopedRecords = isAdmin && filterUser !== "todos"
    ? records.filter((r) => r.user_id === filterUser)
    : records;

  const filtered = userScopedRecords.filter((r) => {
    const matchSearch = !search || r.profile?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === "todos" || r.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  const cardsRecords = isAdmin && filterUser === "todos" ? [] : userScopedRecords;
  const totalRegistros = cardsRecords.length;
  const totalSaldo = cardsRecords.reduce((acc, r) => acc + r.saldo_minutos, 0);
  const horasExtras = cardsRecords.filter((r) => r.tipo === "hora_extra").length;
  const jornadasIncompletas = cardsRecords.filter((r) => r.tipo === "jornada_incompleta").length;

  const selectedEmployeeName = filterUser !== "todos"
    ? employees.find((e) => e.user_id === filterUser)?.full_name || records.find((r) => r.user_id === filterUser)?.profile?.full_name || ""
    : "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{isAdmin ? "Admin" : "Colaborador"} &gt; Banco de Horas</p>
          <h1 className="text-2xl font-bold">Banco de Horas</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
              {filterUser !== "todos"
                ? `Exibindo dados de: ${selectedEmployeeName}`
                : "Acompanhe horas extras e jornadas incompletas"}
            </p>
            {filterUser !== "todos" && (
              <Button variant="ghost" size="sm" onClick={() => setFilterUser("todos")} className="text-xs h-6 px-2">
                ✕ Limpar seleção
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Tolerâncias
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configurar Tolerâncias</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Tolerância para Banco de Horas (minutos)</Label>
                      <p className="text-xs text-muted-foreground">
                        Minutos excedentes acima deste valor serão contabilizados como hora extra
                      </p>
                      <Input
                        type="number"
                        value={toleranciaBH}
                        onChange={(e) => setToleranciaBH(parseInt(e.target.value) || 0)}
                        min={0}
                        max={60}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tolerância para Jornada Incompleta (minutos)</Label>
                      <p className="text-xs text-muted-foreground">
                        Minutos faltantes acima deste valor gerarão ocorrência de jornada incompleta
                      </p>
                      <Input
                        type="number"
                        value={toleranciaJI}
                        onChange={(e) => setToleranciaJI(parseInt(e.target.value) || 0)}
                        min={0}
                        max={60}
                      />
                    </div>
                    <Button onClick={handleSaveTolerances} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button onClick={handleCalculate} disabled={calculating} className="gap-2">
                <Calculator className="h-4 w-4" />
                {calculating ? "Calculando..." : "Calcular Hoje"}
              </Button>
              <Button variant="outline" onClick={handleExportCSV} className="gap-2">
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" onClick={handleExportPDF} className="gap-2">
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-info" />
            <div>
              <p className="text-2xl font-bold">{totalRegistros}</p>
              <p className="text-xs text-muted-foreground">Registros</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-5 w-5 text-success" />
            <div>
              <p className="text-2xl font-bold">{horasExtras}</p>
              <p className="text-xs text-muted-foreground">Horas Extras</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{jornadasIncompletas}</p>
              <p className="text-xs text-muted-foreground">Jornadas Incompletas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div>
              <p className={`text-2xl font-bold ${totalSaldo >= 0 ? "text-success" : "text-destructive"}`}>
                {formatMinutos(totalSaldo)}
              </p>
              <p className="text-xs text-muted-foreground">Saldo Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Registros do Banco de Horas</CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Funcionário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Funcionários</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="hora_extra">Hora Extra</SelectItem>
                <SelectItem value="jornada_incompleta">Jornada Incompleta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-[180px]" />
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={fetchRecords}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead>Funcionário</TableHead>}
                <TableHead>Data</TableHead>
                <TableHead>Trabalhado</TableHead>
                <TableHead>Esperado</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    {loading ? "Carregando..." : "Nenhum registro de banco de horas encontrado."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice((page - 1) * 10, page * 10).map((r) => (
                  <TableRow key={r.id}>
                    {isAdmin && (
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
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => setFilterUser(r.user_id)}
                                className="font-medium text-sm text-left hover:underline"
                              >
                                {r.profile?.full_name || "—"}
                              </button>
                            ) : (
                              <p className="font-medium text-sm">{r.profile?.full_name || "—"}</p>
                            )}
                            <p className="text-xs text-muted-foreground">{r.profile?.matricula || ""}</p>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-sm">
                      {format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">{formatMinutos(r.minutos_trabalhados).replace("+", "")}</TableCell>
                    <TableCell className="text-sm">{formatMinutos(r.minutos_esperados).replace("+", "")}</TableCell>
                    <TableCell className={`text-sm font-medium ${r.saldo_minutos >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatMinutos(r.saldo_minutos)}
                    </TableCell>
                    <TableCell>{tipoBadge(r.tipo)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination currentPage={page} totalItems={filtered.length} pageSize={10} onPageChange={setPage} />
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
