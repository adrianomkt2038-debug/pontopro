import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Registros from "./pages/Registros";
import Usuarios from "./pages/Usuarios";
import Cargos from "./pages/Cargos";
import Escalas from "./pages/Escalas";
import Justificativas from "./pages/Justificativas";
import Aprovacoes from "./pages/Aprovacoes";
import RegistroPonto from "./pages/RegistroPonto";
import MeuPonto from "./pages/MeuPonto";
import CadastroFuncionario from "./pages/CadastroFuncionario";
import TiposRegistro from "./pages/TiposRegistro";
import BancoHoras from "./pages/BancoHoras";
import Alertas from "./pages/Alertas";
import Configuracoes from "./pages/Configuracoes";
import Historico from "./pages/Historico";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Perfil from "./pages/Perfil";
import { Timer } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin, rolesLoaded } = useAuth();
  if (loading || (adminOnly && !rolesLoaded)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[100px] animate-pulse [animation-delay:1s]" />
        
        <div className="relative flex flex-col items-center">
          <div className="relative h-20 w-20 mb-6">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-premium">
              <Timer className="h-10 w-10 text-primary-foreground animate-pulse" />
            </div>
          </div>
          
          <h2 className="text-xl font-bold tracking-tight text-foreground animate-pulse">
            Carregando Ponto Pro...
          </h2>
          <p className="text-sm text-muted-foreground mt-2 font-medium">
            Preparando seu ambiente seguro
          </p>
          
          <div className="mt-8 w-48 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-progress origin-left" />
          </div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/registro-ponto" element={<ProtectedRoute adminOnly><RegistroPonto /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/registros" element={<ProtectedRoute><Registros /></ProtectedRoute>} />
              <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
              <Route path="/cadastro-funcionario" element={<ProtectedRoute><CadastroFuncionario /></ProtectedRoute>} />
              <Route path="/cargos" element={<ProtectedRoute><Cargos /></ProtectedRoute>} />
              <Route path="/escalas" element={<ProtectedRoute><Escalas /></ProtectedRoute>} />
              <Route path="/tipos-registro" element={<ProtectedRoute><TiposRegistro /></ProtectedRoute>} />
              <Route path="/justificativas" element={<ProtectedRoute><Justificativas /></ProtectedRoute>} />
              <Route path="/aprovacoes" element={<ProtectedRoute><Aprovacoes /></ProtectedRoute>} />
              <Route path="/banco-horas" element={<ProtectedRoute><BancoHoras /></ProtectedRoute>} />
              <Route path="/alertas" element={<ProtectedRoute><Alertas /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              <Route path="/historico" element={<ProtectedRoute><Historico /></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
              <Route path="/meu-ponto" element={<ProtectedRoute><MeuPonto /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
