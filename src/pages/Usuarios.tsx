import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Pencil } from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "@/components/TablePagination";
import { FaceRegistration } from "@/components/FaceRegistration";
import { invokeEntityAction } from "@/lib/invokeEntityAction";

interface UserData {
  user_id: string;
  full_name: string;
  email: string;
  matricula: string | null;
  active: boolean;
  roles: string[];
  cargo?: string;
  cargo_id?: string | null;
  escala_id?: string | null;
  avatar_url?: string | null;
}

interface CargoOption { id: string; nome: string }
interface EscalaOption { id: string; nome: string }

export default function Usuarios() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", matricula: "", active: true, role: "", cargo_id: "", escala_id: "" });
  const [saving, setSaving] = useState(false);
  const [cargos, setCargos] = useState<CargoOption[]>([]);
  const [escalas, setEscalas] = useState<EscalaOption[]>([]);
  const [previewAvatar, setPreviewAvatar] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase.from("cargos").select("id, nome").order("nome"),
      supabase.from("escalas").select("id, nome").order("nome"),
    ]);
    setCargos(c || []);
    setEscalas(e || []);
  };

  const fetchUsers = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: funcs }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("funcionarios").select("user_id, cargo_id, escala_id, cargos(nome)"),
    ]);

    const userData: UserData[] = (profiles || []).map((p) => {
      const func = funcs?.find((f) => f.user_id === p.user_id) as any;
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        matricula: p.matricula,
        active: p.active,
        roles: (roles || []).filter((r) => r.user_id === p.user_id).map((r) => r.role),
        cargo: func?.cargos?.nome,
        cargo_id: func?.cargo_id || null,
        escala_id: func?.escala_id || null,
        avatar_url: p.avatar_url,
      };
    });

    setUsers(userData);
    setLoading(false);
  };

  const openEdit = (u: UserData) => {
    setEditUser(u);
    setEditForm({
      full_name: u.full_name,
      matricula: u.matricula || "",
      active: u.active,
      role: u.roles[0] || "colaborador",
      cargo_id: u.cargo_id || "",
      escala_id: u.escala_id || "",
    });
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const currentRole = editUser.roles[0];

      // Protect against removing the last admin
      if (currentRole === "admin" && editForm.role !== "admin") {
        const adminCount = users.filter((u) => u.roles.includes("admin")).length;
        if (adminCount <= 1) {
          toast.error("Não é possível remover o último administrador do sistema.");
          setSaving(false);
          return;
        }
      }

      // Protect against deactivating the last admin
      if (currentRole === "admin" && editUser.active && !editForm.active) {
        const activeAdmins = users.filter((u) => u.roles.includes("admin") && u.active).length;
        if (activeAdmins <= 1) {
          toast.error("Não é possível desativar o último administrador ativo.");
          setSaving(false);
          return;
        }
      }

      await invokeEntityAction("users_update", {
        target_user_id: editUser.user_id,
        full_name: editForm.full_name,
        matricula: editForm.matricula || null,
        active: editForm.active,
        role: editForm.role,
        cargo_id: editForm.cargo_id || null,
        escala_id: editForm.escala_id || null,
      });

      toast.success("Usuário atualizado com sucesso");
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + (err.message || "erro desconhecido"));
    }
    setSaving(false);
  };

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleLabel = (role: string) => {
    const map: Record<string, string> = { admin: "Admin", gestor: "Gestor", colaborador: "Colaborador" };
    return map[role] || role;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-info" />
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-xs text-muted-foreground">Total de Usuários</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div>
              <p className="text-2xl font-bold">{users.filter((u) => u.active).length}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div>
              <p className="text-2xl font-bold">{users.filter((u) => !u.active).length}</p>
              <p className="text-xs text-muted-foreground">Inativos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Lista de Usuários</CardTitle>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full sm:w-[250px]" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop table - hidden on small screens */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Face</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
                ) : (
                  filtered.slice((page - 1) * 10, page * 10).map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            className={`h-8 w-8 ${u.avatar_url ? "cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 ring-offset-background transition-all" : ""}`}
                            onClick={() => u.avatar_url && setPreviewAvatar({ url: u.avatar_url, name: u.full_name })}
                          >
                            <AvatarImage src={u.avatar_url || undefined} alt={u.full_name} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {u.full_name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{u.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-sm">{u.matricula || "—"}</TableCell>
                      <TableCell className="text-sm">{u.cargo || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {u.roles.map((r) => (
                            <Badge key={r} variant="secondary" className="text-xs">{roleLabel(r)}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.active ? "default" : "destructive"}>
                          {u.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <FaceRegistration userId={u.user_id} userName={u.full_name} onRegistered={fetchUsers} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</p>
            ) : (
              filtered.slice((page - 1) * 10, page * 10).map((u) => (
                <div key={u.user_id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        className={`h-10 w-10 shrink-0 ${u.avatar_url ? "cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 ring-offset-background transition-all" : ""}`}
                        onClick={() => u.avatar_url && setPreviewAvatar({ url: u.avatar_url, name: u.full_name })}
                      >
                        <AvatarImage src={u.avatar_url || undefined} alt={u.full_name} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {u.full_name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                    <Badge variant={u.active ? "default" : "destructive"} className="shrink-0 ml-2">
                      {u.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {u.matricula && <span>Mat: {u.matricula}</span>}
                    {u.cargo && <span>• {u.cargo}</span>}
                    {u.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px]">{roleLabel(r)}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <FaceRegistration userId={u.user_id} userName={u.full_name} onRegistered={fetchUsers} />
                    <Button variant="outline" size="sm" onClick={() => openEdit(u)} className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <TablePagination currentPage={page} totalItems={filtered.length} pageSize={10} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Avatar Preview Dialog */}
      <Dialog open={!!previewAvatar} onOpenChange={(open) => !open && setPreviewAvatar(null)}>
        <DialogContent className="max-w-sm p-2 bg-background">
          {previewAvatar && (
            <img
              src={previewAvatar.url}
              alt={previewAvatar.name}
              className="w-full h-auto rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input value={editForm.matricula} onChange={(e) => setEditForm({ ...editForm, matricula: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Perfil / Papel</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={editForm.cargo_id || "none"} onValueChange={(v) => setEditForm({ ...editForm, cargo_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar cargo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {cargos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Escala</Label>
              <Select value={editForm.escala_id || "none"} onValueChange={(v) => setEditForm({ ...editForm, escala_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar escala" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {escalas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={editForm.active} onCheckedChange={(v) => setEditForm({ ...editForm, active: v })} />
            </div>
            <Button onClick={handleSave} disabled={saving || !editForm.full_name} className="w-full">
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
