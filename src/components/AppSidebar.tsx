import {
  LayoutDashboard,
  Clock,
  Users,
  Briefcase,
  CalendarClock,
  Wallet,
  Bell,
  FileText,
  CheckSquare,
  Timer,
  ScanFace,
  UserPlus,
  ListChecks,
  Settings,
  History,
  UserCircle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

// Items visible to gestor and admin
const mainItems = [
  { title: "Painel", subtitle: "Visão geral", url: "/dashboard", icon: LayoutDashboard },
  { title: "Registros do Dia", subtitle: "Pontos do dia", url: "/registros", icon: Clock },
  { title: "Ocorrências", subtitle: "Ocorrências e edições", url: "/aprovacoes", icon: CheckSquare },
  { title: "Justificativas", subtitle: "Atestados e faltas", url: "/justificativas", icon: FileText },
  { title: "Banco de Horas", subtitle: "Horas extras e saldos", url: "/banco-horas", icon: Wallet },
  { title: "Alertas", subtitle: "Ocorrências automáticas", url: "/alertas", icon: Bell },
];

// Items only for colaborador
const colaboradorItems = [
  { title: "Painel", subtitle: "Visão geral", url: "/dashboard", icon: LayoutDashboard },
  { title: "Meu Ponto", subtitle: "Registro facial", url: "/meu-ponto", icon: ScanFace },
  { title: "Meu Perfil", subtitle: "Editar informações", url: "/perfil", icon: UserCircle },
];

const adminItems = [
  { title: "Registro Facial", subtitle: "Terminal de reconhecimento", url: "/registro-ponto", icon: ScanFace },
  { title: "Usuários", subtitle: "Gerenciar", url: "/usuarios", icon: Users },
  { title: "Cadastro", subtitle: "Novo funcionário", url: "/cadastro-funcionario", icon: UserPlus },
  { title: "Cargos", subtitle: "Funções", url: "/cargos", icon: Briefcase },
  { title: "Escalas", subtitle: "Horários", url: "/escalas", icon: CalendarClock },
  { title: "Tipos de Registro", subtitle: "Batidas", url: "/tipos-registro", icon: ListChecks },
  { title: "Configurações", subtitle: "Sistema", url: "/configuracoes", icon: Settings },
  { title: "Histórico", subtitle: "Auditoria", url: "/historico", icon: History },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin, isGestor, user } = useAuth();
  const isColaborador = !isAdmin && !isGestor;
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchAlertCount = async () => {
      let query = supabase
        .from("ocorrencias")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");
      if (!isAdmin) {
        query = query.eq("user_id", user.id);
      }
      const { count } = await query;
      setAlertCount(count || 0);
    };
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 300000);
    return () => clearInterval(interval);
  }, [user, isAdmin]);

  const isActive = (path: string) => location.pathname === path;


  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/30 bg-sidebar shadow-premium">
      <SidebarHeader className={collapsed ? "px-0 py-6" : "px-4 py-6"}>
        <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-4'}`}>
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl shrink-0 ${collapsed ? 'bg-sidebar-accent/50' : 'bg-gradient-premium shadow-md'}`}>
            <Timer className={`h-6 w-6 ${collapsed ? 'text-sidebar-primary' : 'text-sidebar-primary-foreground'}`} />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <h2 className="text-lg font-extrabold tracking-tight text-sidebar-primary-foreground font-['Space_Grotesk'] leading-none">
                Ponto Pro
              </h2>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-sidebar-foreground/40 mt-1">
                Time Insight
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {!collapsed && <Separator className="mx-6 w-auto bg-sidebar-border/30" />}

      <SidebarContent className={collapsed ? "px-1 py-3" : "px-3 py-4 space-y-2"}>
        <SidebarGroup className="gap-1 p-0">
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[9px] font-bold tracking-[0.15em] mb-2 px-3">
              {isColaborador ? "Navegação" : "Principal"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {(isColaborador ? colaboradorItems : mainItems).map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title} className={collapsed ? "flex justify-center w-full" : ""}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      size="lg"
                      className={`transition-all duration-300 ${active ? 'bg-sidebar-accent shadow-sm' : ''}`}
                    >
                      <NavLink
                        to={item.url}
                        end
                        className={`relative flex items-center text-sidebar-foreground transition-all duration-300 hover:text-sidebar-accent-foreground ${
                          collapsed
                            ? 'justify-center rounded-xl hover:bg-sidebar-accent/50 p-0'
                            : 'gap-3.5 px-4 py-3 rounded-2xl hover:bg-sidebar-accent group'
                        }`}
                        activeClassName={
                          collapsed
                            ? 'bg-sidebar-accent/60 text-sidebar-primary-foreground'
                            : 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                        }
                      >
                        <item.icon className={`h-[18px] w-[18px] shrink-0 transition-transform duration-300 ${!collapsed && 'group-hover:scale-110 group-hover:rotate-3'}`} />
                        {!collapsed && (
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm tracking-tight">{item.title}</span>
                              {item.url === "/alertas" && alertCount > 0 && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[9px] font-extrabold text-destructive-foreground shadow-sm">
                                  {alertCount > 99 ? "99+" : alertCount}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] opacity-40 leading-tight font-medium mt-0.5">{item.subtitle}</p>
                          </div>
                        )}
                        {collapsed && item.url === "/alertas" && alertCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[8px] font-extrabold text-destructive-foreground border-2 border-sidebar-background shadow-sm">
                            {alertCount > 99 ? "99+" : alertCount}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <div className="pt-2">
            {!collapsed && <Separator className="mx-3 my-3 w-auto bg-sidebar-border/30" />}
            {collapsed && <div className="my-2 border-t border-sidebar-border/20 mx-2" />}
            <SidebarGroup className="gap-1 p-0 pt-1">
              {!collapsed && (
                <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[9px] font-bold tracking-[0.15em] mb-2 px-3">
                  Gerenciamento
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
                  {adminItems.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem key={item.title} className={collapsed ? "flex justify-center w-full" : ""}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          size="lg"
                          className={`transition-all duration-300 ${active ? 'bg-sidebar-accent shadow-sm' : ''}`}
                        >
                          <NavLink
                            to={item.url}
                            end
                            className={`relative flex items-center text-sidebar-foreground transition-all duration-300 hover:text-sidebar-accent-foreground ${
                              collapsed
                                ? 'justify-center rounded-xl hover:bg-sidebar-accent/50 p-0'
                                : 'gap-3.5 px-4 py-3 rounded-2xl hover:bg-sidebar-accent group'
                            }`}
                            activeClassName={
                              collapsed
                                ? 'bg-sidebar-accent/60 text-sidebar-primary-foreground'
                                : 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                            }
                          >
                            <item.icon className={`h-[18px] w-[18px] shrink-0 transition-transform duration-300 ${!collapsed && 'group-hover:scale-110 group-hover:rotate-3'}`} />
                            {!collapsed && (
                              <div className="min-w-0">
                                <span className="text-sm tracking-tight">{item.title}</span>
                                <p className="text-[10px] opacity-40 leading-tight font-medium mt-0.5">{item.subtitle}</p>
                              </div>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
