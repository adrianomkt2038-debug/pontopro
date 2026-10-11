import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Sun, Moon, Bell } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, signOut, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const roleName = isAdmin
    ? "Administrador"
    : roles.includes("gestor")
      ? "Gestor"
      : "Colaborador";
  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background/50">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between border-b bg-card/80 backdrop-blur-md px-6 shrink-0 sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-9 w-9" />
              <div className="h-6 w-[1px] bg-border hidden sm:block" />
              <h2 className="text-sm font-semibold text-muted-foreground hidden md:block">
                Ponto Pro <span className="mx-1 text-border">/</span>
                <span className="text-foreground capitalize">
                  {location.pathname.replace("/", "").replace("-", " ") ||
                    "Dashboard"}
                </span>
              </h2>
            </div>

            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-3">
                {/* 
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 relative"
                    >
                      <Bell className="h-4.5 w-4.5 text-muted-foreground" />
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-card" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Notificações</TooltipContent>
                </Tooltip> 
                */}

                <div className="h-8 w-[1px] bg-border mx-1" />

                {profile && (
                  <div
                    className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-accent/50 cursor-pointer transition-all duration-200 border border-transparent hover:border-border"
                    onClick={() => navigate("/perfil")}
                  >
                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-semibold leading-none">
                        {profile.full_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                        {roleName}
                      </p>
                    </div>
                    <Avatar className="h-9 w-9 border-2 border-background shadow-soft">
                      <AvatarImage
                        src={profile.avatar_url || undefined}
                        alt={profile.full_name}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}

                <div className="flex items-center gap-1 ml-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="h-9 w-9 rounded-full"
                      >
                        {theme === "dark" ? (
                          <Sun className="h-4.5 w-4.5 text-yellow-500" />
                        ) : (
                          <Moon className="h-4.5 w-4.5 text-slate-700" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={signOut}
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <LogOut className="h-4.5 w-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sair</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </TooltipProvider>
          </header>

          <main className="flex-1 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-6 sm:p-8 max-w-[1600px] mx-auto w-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
