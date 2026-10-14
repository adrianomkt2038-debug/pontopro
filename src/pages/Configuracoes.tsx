import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Shield, UserPlus, Mail, Clock, Bell, RefreshCw, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ConfigItem {
  id: string;
  chave: string;
  valor: string;
  tipo: string;
  descricao: string | null;
}

const LABELS: Record<string, { label: string; icon: typeof Settings; group: string }> = {
  permitir_auto_cadastro: { label: "Permitir Auto-Cadastro", icon: UserPlus, group: "Acesso" },
  role_padrao_novos_usuarios: { label: "Papel Padrão para Novos Usuários", icon: Shield, group: "Acesso" },
  exigir_confirmacao_email: { label: "Exigir Confirmação de E-mail", icon: Mail, group: "Acesso" },
  permitir_registro_sem_escala: { label: "Registro de Ponto sem Escala", icon: Clock, group: "Ponto" },
  tempo_sessao_minutos: { label: "Tempo de Sessão (minutos)", icon: Clock, group: "Sistema" },
  notificar_admin_novo_cadastro: { label: "Notificar Admin em Novo Cadastro", icon: Bell, group: "Notificações" },
  folha_pro_url: { label: "Link externo do Folha Pro", icon: ExternalLink, group: "Integrações" },
  folha_pro_visivel_gestores: { label: "Exibir botão Folha Pro para gestores", icon: ExternalLink, group: "Integrações" },
};

export default function Configuracoes() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerenciar-configuracoes", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.success) {
        setConfigs(data.data);
        setPendingChanges({});
      } else {
        toast.error(data?.error || "Erro ao carregar configurações");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar configurações");
    }
    setLoading(false);
  };

  const handleChange = (chave: string, valor: string) => {
    setPendingChanges((prev) => ({ ...prev, [chave]: valor }));
  };

  const handleSave = async (chave: string) => {
    const valor = pendingChanges[chave];
    if (valor === undefined) return;

    setSaving(chave);
    try {
      const { data, error } = await supabase.functions.invoke("gerenciar-configuracoes", {
        body: { action: "update", chave, valor },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Configuração atualizada com sucesso");
        setConfigs((prev) =>
          prev.map((c) => (c.chave === chave ? { ...c, valor: String(valor) } : c))
        );
        setPendingChanges((prev) => {
          const next = { ...prev };
          delete next[chave];
          return next;
        });
      } else {
        toast.error(data?.error || "Erro ao salvar");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configuração");
    }
    setSaving(null);
  };

  const getValue = (chave: string) => {
    if (pendingChanges[chave] !== undefined) return pendingChanges[chave];
    return configs.find((c) => c.chave === chave)?.valor || "";
  };

  const hasChange = (chave: string) => pendingChanges[chave] !== undefined;
  const groups = [...new Set(Object.values(LABELS).map((l) => l.group))];

  const renderSetting = (config: ConfigItem) => {
    const meta = LABELS[config.chave];
    if (!meta) return null;
    const Icon = meta.icon;
    const value = getValue(config.chave);
    const changed = hasChange(config.chave);

    return (
      <div key={config.chave} className="flex items-center justify-between py-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Icon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{meta.label}</p>
            <p className="text-xs text-muted-foreground">{config.descricao}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {config.tipo === "boolean" && (
            <Switch
              checked={value === "true"}
              onCheckedChange={(checked) =>
                handleChange(config.chave, checked ? "true" : "false")
              }
            />
          )}
          {config.tipo === "url" && (
            <Input
              type="url"
              className="w-[min(70vw,20rem)]"
              placeholder="https://exemplo.com"
              value={value}
              onChange={(e) => handleChange(config.chave, e.target.value)}
            />
          )}
          {config.tipo === "number" && (
            <Input
              type="number"
              className="w-24"
              value={value}
              onChange={(e) => handleChange(config.chave, e.target.value)}
              min={1}
            />
          )}
          {config.tipo === "select" && config.chave === "role_padrao_novos_usuarios" && (
            <Select value={value} onValueChange={(v) => handleChange(config.chave, v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="colaborador">Colaborador</SelectItem>
              </SelectContent>
            </Select>
          )}
          {changed && (
            <Button
              size="sm"
              onClick={() => handleSave(config.chave)}
              disabled={saving === config.chave}
              className="gap-1"
            >
              <Save className="h-3 w-3" />
              {saving === config.chave ? "..." : "Salvar"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Admin &gt; Configurações</p>
          <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
          <p className="text-muted-foreground">Gerencie as configurações gerais da plataforma</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchConfigs}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {groups.map((group) => {
        const groupConfigs = configs.filter((c) => LABELS[c.chave]?.group === group);
        if (groupConfigs.length === 0) return null;

        return (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="text-lg">{group}</CardTitle>
              <CardDescription>
                {group === "Acesso" && "Controle de cadastro e permissões de acesso"}
                {group === "Ponto" && "Regras para registro de ponto"}
                {group === "Sistema" && "Configurações gerais do sistema"}
                {group === "Notificações" && "Alertas e notificações automáticas"}
                {group === "Integrações" && "Links externos usados pelos botões da barra lateral"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {groupConfigs.map(renderSetting)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
