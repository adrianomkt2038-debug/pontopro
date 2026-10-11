import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { invokeEntityAction } from "@/lib/invokeEntityAction";
import { RefreshCw, Trash2, History, Activity, Globe, Monitor, Smartphone, MapPin, Shield } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TablePagination } from "@/components/TablePagination";

const LABELS: Record<string, string> = {
  permitir_auto_cadastro: "Permitir Auto-Cadastro",
  role_padrao_novos_usuarios: "Papel Padrão para Novos Usuários",
  exigir_confirmacao_email: "Exigir Confirmação de E-mail",
  permitir_registro_sem_escala: "Registro de Ponto sem Escala",
  tempo_sessao_minutos: "Tempo de Sessão (minutos)",
  notificar_admin_novo_cadastro: "Notificar Admin em Novo Cadastro",
};

const ACTION_LABELS: Record<string, string> = {
  entrada: "Entrada",
  almoco_saida: "Saída Almoço",
  almoco_retorno: "Retorno Almoço",
  saida: "Saída",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  users_update: "Atualizar Usuário",
  admin_create_funcionario: "Cadastrar Funcionário",
  profile_update_self: "Atualizar Perfil",
  cargo_create: "Criar Cargo",
  cargo_update: "Atualizar Cargo",
  cargo_delete: "Excluir Cargo",
  escala_create: "Criar Escala",
  escala_update: "Atualizar Escala",
  escala_delete: "Excluir Escala",
  tipo_registro_create: "Criar Tipo Registro",
  tipo_registro_update: "Atualizar Tipo Registro",
  tipo_registro_delete: "Excluir Tipo Registro",
  ocorrencia_create: "Criar Ocorrência",
  ocorrencia_approve: "Aprovar Ocorrência",
  ocorrencia_reject: "Rejeitar Ocorrência",
  justificativa_create: "Criar Justificativa",
  justificativa_approve: "Aprovar Justificativa",
  justificativa_reject: "Rejeitar Justificativa",
  configuracoes_ponto_update: "Atualizar Tolerâncias",
  face_descriptor_upsert: "Cadastrar Face",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  usuario: "Usuário",
  funcionario: "Funcionário",
  profile: "Perfil",
  cargo: "Cargo",
  escala: "Escala",
  tipo_registro: "Tipo Registro",
  ocorrencia: "Ocorrência",
  justificativa: "Justificativa",
  configuracoes_ponto: "Config. Ponto",
  face_descriptor: "Face",
};

interface AuditItem {
  id: string;
  user_id: string;
  user_name: string;
  chave: string;
  valor_anterior: string | null;
  valor_novo: string;
  created_at: string;
}

interface AuditEntidade {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface SessaoPonto {
  id: string;
  user_id: string;
  acao: string;
  ip_address: string | null;
  city: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  user_agent: string | null;
  sistema_operacional: string | null;
  created_at: string;
  profile?: { full_name: string; avatar_url: string | null };
}

export default function Historico() {
  const [auditLog, setAuditLog] = useState<AuditItem[]>([]);
  const [auditEntidades, setAuditEntidades] = useState<AuditEntidade[]>([]);
  const [sessoes, setSessoes] = useState<SessaoPonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntidades, setLoadingEntidades] = useState(true);
  const [loadingSessoes, setLoadingSessoes] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [clearingSessoes, setClearingSessoes] = useState(false);
  const [clearingEntidades, setClearingEntidades] = useState(false);
  const [page, setPage] = useState(1);
  const [pageEntidades, setPageEntidades] = useState(1);
  const [pageSessoes, setPageSessoes] = useState(1);
  const [previewAvatar, setPreviewAvatar] = useState<{ url: string; name: string } | null>(null);
  const [selectedSessao, setSelectedSessao] = useState<SessaoPonto | null>(null);
  const pageSize = 10;

  useEffect(() => {
    fetchAuditLog();
    fetchAuditEntidades();
    fetchSessoes();
  }, []);

  const fetchAuditLog = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerenciar-configuracoes", {
        body: { action: "audit" },
      });
      if (error) throw error;
      if (data?.success) {
        setAuditLog(data.data);
      } else {
        toast.error(data?.error || "Erro ao carregar histórico");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar histórico");
    }
    setLoading(false);
  };

  const fetchAuditEntidades = async () => {
    setLoadingEntidades(true);
    try {
      const data = await invokeEntityAction<AuditEntidade[]>("audit_entidades_list", {});
      setAuditEntidades(data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar auditoria de entidades");
    }
    setLoadingEntidades(false);
  };

  const fetchSessoes = async () => {
    setLoadingSessoes(true);
    try {
      const data = await invokeEntityAction<SessaoPonto[]>("sessoes_list", {});
      setSessoes(data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar sessões");
    }
    setLoadingSessoes(false);
  };

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerenciar-configuracoes", {
        body: { action: "clear_audit" },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Histórico limpo com sucesso");
        setAuditLog([]);
      } else {
        toast.error(data?.error || "Erro ao limpar histórico");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao limpar histórico");
    }
    setClearing(false);
  };

  const handleClearSessoes = async () => {
    setClearingSessoes(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerenciar-configuracoes", {
        body: { action: "clear_sessoes" },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Sessões limpas com sucesso");
        setSessoes([]);
      } else {
        toast.error(data?.error || "Erro ao limpar sessões");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao limpar sessões");
    }
    setClearingSessoes(false);
  };

  const handleClearEntidades = async () => {
    setClearingEntidades(true);
    try {
      await invokeEntityAction("audit_entidades_clear", {});
      toast.success("Auditoria de entidades limpa com sucesso");
      setAuditEntidades([]);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao limpar auditoria");
    }
    setClearingEntidades(false);
  };

  const getChaveLabel = (chave: string) => LABELS[chave] || chave;

  const paginatedLog = useMemo(() => {
    const start = (page - 1) * pageSize;
    return auditLog.slice(start, start + pageSize);
  }, [auditLog, page]);

  const paginatedEntidades = useMemo(() => {
    const start = (pageEntidades - 1) * pageSize;
    return auditEntidades.slice(start, start + pageSize);
  }, [auditEntidades, pageEntidades]);

  const paginatedSessoes = useMemo(() => {
    const start = (pageSessoes - 1) * pageSize;
    return sessoes.slice(start, start + pageSize);
  }, [sessoes, pageSessoes]);

  const mapSrc = useMemo(() => {
    if (selectedSessao?.latitude == null || selectedSessao?.longitude == null) return "";
    const lat = Number(selectedSessao.latitude).toFixed(6);
    const lon = Number(selectedSessao.longitude).toFixed(6);
    return `https://www.google.com/maps?q=loc:${lat},${lon}&z=16&hl=pt-BR&output=embed`;
  }, [selectedSessao]);

  const osIcon = (os: string | null) => {
    if (!os) return <Globe className="h-4 w-4 text-muted-foreground" />;
    if (os === "Windows" || os === "macOS" || os === "Linux") return <Monitor className="h-4 w-4 text-muted-foreground" />;
    return <Smartphone className="h-4 w-4 text-muted-foreground" />;
  };

  const getDetailsSummary = (details: Record<string, unknown>) => {
    const entries = Object.entries(details).filter(([k]) => k !== "target_user_id");
    if (entries.length === 0) return "—";
    return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Admin &gt; Histórico</p>
        <h1 className="text-2xl font-bold">Histórico de Alterações</h1>
        <p className="text-muted-foreground">Registro de todas as alterações e sessões do sistema</p>
      </div>

      <Tabs defaultValue="entidades" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entidades" className="gap-1.5">
            <Shield className="h-4 w-4" />
            Ações do Sistema
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-1.5">
            <History className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="sessoes" className="gap-1.5">
            <Activity className="h-4 w-4" />
            Registro de Ponto
          </TabsTrigger>
        </TabsList>

        {/* TAB: Entidades */}
        <TabsContent value="entidades">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    Auditoria Completa
                  </CardTitle>
                  <CardDescription>Todas as ações administrativas e operacionais do sistema</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={fetchAuditEntidades}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {auditEntidades.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                          Limpar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Limpar auditoria de entidades?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Todos os registros de auditoria de ações serão removidos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearEntidades} disabled={clearingEntidades}>
                            {clearingEntidades ? "Limpando..." : "Sim, limpar tudo"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingEntidades ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : auditEntidades.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Nenhuma ação registrada ainda
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Entidade</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEntidades.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm">{item.user_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {AUDIT_ACTION_LABELS[item.action] || item.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {ENTITY_TYPE_LABELS[item.entity_type] || item.entity_type}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                            {getDetailsSummary(item.details || {})}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {auditEntidades.length > pageSize && (
                <TablePagination
                  currentPage={pageEntidades}
                  totalItems={auditEntidades.length}
                  pageSize={pageSize}
                  onPageChange={setPageEntidades}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Configurações */}
        <TabsContent value="configuracoes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    Registros de Auditoria
                  </CardTitle>
                  <CardDescription>Últimas 50 alterações nas configurações</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={fetchAuditLog}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {auditLog.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                          Limpar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Limpar todo o histórico?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Todos os registros de auditoria serão removidos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearHistory} disabled={clearing}>
                            {clearing ? "Limpando..." : "Sim, limpar tudo"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Nenhuma alteração registrada
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Configuração</TableHead>
                        <TableHead>Valor Anterior</TableHead>
                        <TableHead>Novo Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLog.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm">{item.user_name}</TableCell>
                          <TableCell className="text-sm font-medium">{getChaveLabel(item.chave)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.valor_anterior ?? "—"}</TableCell>
                          <TableCell className="text-sm font-medium">{item.valor_novo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {auditLog.length > pageSize && (
                <TablePagination
                  currentPage={page}
                  totalItems={auditLog.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Sessões de Ponto */}
        <TabsContent value="sessoes" className="space-y-4">
          {/* Mapa */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                Mapa de Registro
                {selectedSessao && (
                  <span className="text-sm font-normal text-muted-foreground">
                    — {selectedSessao.profile?.full_name || "Usuário"} ({ACTION_LABELS[selectedSessao.acao] || selectedSessao.acao})
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {selectedSessao?.latitude != null ? (
                  <span>
                    Coordenadas: <span className="font-mono text-foreground">{Number(selectedSessao.latitude).toFixed(6)}, {Number(selectedSessao.longitude).toFixed(6)}</span>
                    {selectedSessao.city && <> — {selectedSessao.city}</>}
                    {selectedSessao.ip_address && <> · IP: <span className="font-mono">{selectedSessao.ip_address}</span></>}
                  </span>
                ) : (
                  "Clique em uma sessão na tabela abaixo para ver a localização no mapa"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border bg-muted/30" style={{ height: 400 }}>
                {mapSrc ? (
                  <iframe
                    title="Mapa de Registro"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={mapSrc}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Selecione uma sessão para ver a localização</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Sessões */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    Sessões de Registro
                  </CardTitle>
                  <CardDescription>Histórico detalhado de cada batida com IP, localização e dispositivo</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={fetchSessoes}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {sessoes.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                          Limpar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Limpar todas as sessões?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Todos os registros de sessões de ponto serão removidos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearSessoes} disabled={clearingSessoes}>
                            {clearingSessoes ? "Limpando..." : "Sim, limpar tudo"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSessoes ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : sessoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Nenhuma sessão registrada ainda
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data / Hora</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>IP / Localização</TableHead>
                        <TableHead>Sistema Operacional</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSessoes.map((s) => (
                        <TableRow
                          key={s.id}
                          className={`${s.latitude ? "cursor-pointer" : "opacity-60"} ${selectedSessao?.id === s.id ? "bg-muted" : ""}`}
                          onClick={() => s.latitude && s.longitude && setSelectedSessao(s)}
                        >
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(s.created_at), "dd/MM/yyyy, HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar
                                className={`h-8 w-8 ${s.profile?.avatar_url ? "cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  s.profile?.avatar_url && setPreviewAvatar({ url: s.profile.avatar_url, name: s.profile.full_name });
                                }}
                              >
                                <AvatarImage src={s.profile?.avatar_url || undefined} alt={s.profile?.full_name} />
                                <AvatarFallback>{s.profile?.full_name?.[0] || "?"}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{s.profile?.full_name || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">{ACTION_LABELS[s.acao] || s.acao}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {s.country_code && (
                                <img
                                  src={`https://flagcdn.com/w20/${s.country_code}.png`}
                                  alt={s.country_code}
                                  className="h-4 w-auto rounded-sm"
                                />
                              )}
                              <div className="text-xs">
                                <p className="font-mono">{s.ip_address || "—"}</p>
                                {s.city && (
                                  <p className="text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {s.city}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {osIcon(s.sistema_operacional)}
                              <span className="text-sm">{s.sistema_operacional || "—"}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {sessoes.length > pageSize && (
                <TablePagination
                  currentPage={pageSessoes}
                  totalItems={sessoes.length}
                  pageSize={pageSize}
                  onPageChange={setPageSessoes}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Avatar Preview Dialog */}
      <Dialog open={!!previewAvatar} onOpenChange={() => setPreviewAvatar(null)}>
        <DialogContent className="max-w-md p-2">
          {previewAvatar && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={previewAvatar.url}
                alt={previewAvatar.name}
                className="w-full rounded-lg object-cover"
              />
              <p className="text-sm font-medium">{previewAvatar.name}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
