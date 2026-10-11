import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Clock, AlertTriangle, CheckCircle, FileText, TrendingUp, BarChart3, Wallet, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { format, subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { isAdmin, user } = useAuth();
  const [stats, setStats] = useState({
    totalUsuarios: 0,
    presentes: 0,
    ausentes: 0,
    emAndamento: 0,
    justificativasPendentes: 0,
    ocorrenciasPendentes: 0,
    taxaPresenca: 0,
    saldoHoras: 0,
  });
  const [chartData, setChartData] = useState<{ dia: string; presentes: number; ausentes: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [periodo, setPeriodo] = useState("7");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [isAdmin, user, periodo]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchChartData(), fetchSaldoHoras()]);
    setLoading(false);
  };

  const fetchSaldoHoras = async () => {
    if (!user) return;
    let query = supabase.from("banco_horas").select("saldo_minutos");
    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }
    const { data } = await query;
    const total = (data || []).reduce((acc, r) => acc + (r.saldo_minutos || 0), 0);
    setStats((prev) => ({ ...prev, saldoHoras: total }));
  };

  const fetchStats = async () => {
    const today = format(new Date(), "yyyy-MM-dd");

    let registrosQuery = supabase.from("registros_ponto").select("status").eq("data", today);
    if (!isAdmin && user) {
      registrosQuery = registrosQuery.eq("user_id", user.id);
    }
    const registrosRes = await registrosQuery;
    const registros = registrosRes.data || [];

    let totalUsuarios = 0;
    let justificativasPendentes = 0;
    let ocorrenciasPendentes = 0;

    if (isAdmin) {
      const [profilesRes, justRes, ocRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("justificativas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("ocorrencias").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      ]);
      totalUsuarios = profilesRes.count || 0;
      justificativasPendentes = justRes.count || 0;
      ocorrenciasPendentes = ocRes.count || 0;
    }

    const presentes = registros.filter((r) => r.status === "completo").length;
    const emAndamento = registros.filter((r) => r.status === "em_andamento").length;
    const ausentes = registros.filter((r) => r.status === "ausente" || r.status === "pendente").length;
    const totalRegistros = registros.length;

    setStats((prev) => ({
      ...prev,
      totalUsuarios,
      presentes,
      ausentes,
      emAndamento,
      justificativasPendentes,
      ocorrenciasPendentes,
      taxaPresenca: totalRegistros > 0 ? Math.round(((presentes + emAndamento) / totalRegistros) * 100) : 0,
    }));

    setPieData([
      { name: "Presentes", value: presentes, color: "hsl(var(--success))" },
      { name: "Em Andamento", value: emAndamento, color: "hsl(var(--info))" },
      { name: "Ausentes", value: ausentes, color: "hsl(var(--destructive))" },
    ].filter((d) => d.value > 0));
  };

  const fetchChartData = async () => {
    const numDays = parseInt(periodo);
    const days = Array.from({ length: numDays }, (_, i) => {
      const d = subDays(new Date(), numDays - 1 - i);
      return { date: d, dateStr: format(d, "yyyy-MM-dd"), label: format(d, numDays <= 7 ? "EEE dd/MM" : "dd/MM", { locale: ptBR }) };
    });

    const startDate = days[0].dateStr;
    const endDate = days[numDays - 1].dateStr;

    let query = supabase
      .from("registros_ponto")
      .select("data, status")
      .gte("data", startDate)
      .lte("data", endDate);

    if (!isAdmin && user) {
      query = query.eq("user_id", user.id);
    }

    const { data: registros } = await query;

    const chart = days.map((day) => {
      const dayRegistros = (registros || []).filter((r: any) => r.data === day.dateStr);
      return {
        dia: day.label,
        presentes: dayRegistros.filter((r: any) => r.status === "completo" || r.status === "em_andamento").length,
        ausentes: dayRegistros.filter((r: any) => r.status === "ausente" || r.status === "pendente").length,
      };
    });

    setChartData(chart);
  };

  const todayStr = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const saldoHorasAbsoluto = Math.abs(stats.saldoHoras);
  const saldoHorasFormatado = `${stats.saldoHoras < 0 ? "-" : "+"}${Math.floor(saldoHorasAbsoluto / 60)}h${String(saldoHorasAbsoluto % 60).padStart(2, "0")}`;

  const adminStatCards = [
    { title: "Funcionários", value: stats.totalUsuarios, subtitle: "Ativos no sistema", icon: Users, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    { title: "Presentes", value: stats.presentes, subtitle: "Registros de hoje", icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { title: "Em Andamento", value: stats.emAndamento, subtitle: "Jornada ativa", icon: Clock, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    { title: "Ausentes", value: stats.ausentes, subtitle: "Sem registro hoje", icon: AlertTriangle, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Dashboard Analítico</p>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
            Visão Geral
          </h1>
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <p className="text-sm font-medium capitalize">{todayStr}</p>
          </div>
        </motion.div>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {(isAdmin ? adminStatCards : []).map((stat) => (
          <motion.div key={stat.title} variants={item}>
            <Card className="overflow-hidden border-none shadow-soft hover:shadow-premium transition-all duration-300 group cursor-default h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">{stat.title}</p>
                    <div className="flex items-baseline gap-1">
                      <h3 className="text-3xl font-bold tracking-tight">{loading ? "—" : stat.value}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground/80 font-medium">{stat.subtitle}</p>
                  </div>
                  <div className={`p-3 rounded-2xl ${stat.color} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {!isAdmin && (
          <>
            <motion.div variants={item}>
              <Card className="overflow-hidden border-none shadow-soft hover:shadow-premium transition-all duration-300 group cursor-default">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">Meu Saldo</p>
                      <h3 className="text-3xl font-bold tracking-tight">{loading ? "—" : saldoHorasFormatado}</h3>
                      <div className="flex items-center gap-1">
                        {stats.saldoHoras >= 0 ? (
                          <ArrowUpRight className="h-3 w-3 text-success" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 text-destructive" />
                        )}
                        <p className="text-xs font-medium text-muted-foreground">
                          {stats.saldoHoras >= 0 ? "Saldo positivo" : "Saldo negativo"}
                        </p>
                      </div>
                    </div>
                    <div className={`p-3 rounded-2xl ${stats.saldoHoras >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"} transition-transform duration-300 group-hover:scale-110`}>
                      <Wallet className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={item}>
              <Card className="overflow-hidden border-none shadow-soft hover:shadow-premium transition-all duration-300 group cursor-default">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">Presença Hoje</p>
                      <h3 className="text-3xl font-bold tracking-tight">{loading ? "—" : stats.presentes > 0 ? "Registrado" : "Pendente"}</h3>
                      <p className="text-xs text-muted-foreground/80 font-medium">Status do registro atual</p>
                    </div>
                    <div className={`p-3 rounded-2xl ${stats.presentes > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"} transition-transform duration-300 group-hover:scale-110`}>
                      <CheckCircle className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>

      {isAdmin && (
        <motion.div 
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <motion.div variants={item}>
            <Card className="border-none shadow-soft hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{loading ? "—" : stats.justificativasPendentes}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Justificativas Pendentes</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="border-none shadow-soft hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{loading ? "—" : stats.ocorrenciasPendentes}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Ocorrências Pendentes</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="border-none shadow-soft hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{loading ? "—" : `${stats.taxaPresenca}%`}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Taxa de Presença Hoje</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      <div className={`grid gap-6 ${pieData.length > 0 && isAdmin ? "lg:grid-cols-3" : "grid-cols-1"}`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className={pieData.length > 0 && isAdmin ? "lg:col-span-2" : ""}
        >
          <Card className="border-none shadow-premium overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0 pb-6 border-b border-border/50">
              <div>
                <CardTitle className="text-lg font-bold">Relatório de Presença</CardTitle>
                <p className="text-sm text-muted-foreground">Volume de registros ativos no período selecionado</p>
              </div>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-full sm:w-[140px] bg-accent/30 border-none rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="15">Últimos 15 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[300px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/30" />
                      <XAxis 
                        dataKey="dia" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "none",
                          borderRadius: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="presentes" name="Presentes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={24} />
                      <Bar dataKey="ausentes" name="Ausentes" fill="hsl(var(--destructive)/0.7)" radius={[6, 6, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground font-medium italic">
                    {loading ? "Processando dados..." : "Nenhum registro encontrado"}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {pieData.length > 0 && isAdmin && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <Card className="border-none shadow-premium h-full flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">Distribuição Hoje</CardTitle>
                <p className="text-sm text-muted-foreground">Status da equipe em tempo real</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center gap-6">
                <div className="h-[200px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60} 
                        outerRadius={85} 
                        dataKey="value" 
                        paddingAngle={5}
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "none",
                          borderRadius: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-3xl font-extrabold">{stats.presentes + stats.emAndamento}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ativos</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between p-3 rounded-xl bg-accent/20 border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: d.color }} />
                        <span className="text-sm font-semibold">{d.name}</span>
                      </div>
                      <span className="text-sm font-bold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
