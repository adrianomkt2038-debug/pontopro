
-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'colaborador');

-- Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  matricula TEXT,
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Tabela de roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função segura para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Tabela de cargos
CREATE TABLE public.cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  nivel INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

-- Tabela de escalas
CREATE TABLE public.escalas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  hora_entrada TIME NOT NULL DEFAULT '08:00',
  hora_saida TIME NOT NULL DEFAULT '17:00',
  hora_almoco_inicio TIME NOT NULL DEFAULT '12:00',
  hora_almoco_fim TIME NOT NULL DEFAULT '13:00',
  dias_semana INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  carga_horaria_diaria INTERVAL NOT NULL DEFAULT '8 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;

-- Tabela de funcionários (vincula perfil a cargo e escala)
CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  cargo_id UUID REFERENCES public.cargos(id),
  escala_id UUID REFERENCES public.escalas(id),
  data_admissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_demissao DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

-- Tabela de registros de ponto
CREATE TABLE public.registros_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  entrada TIMESTAMPTZ,
  almoco_saida TIMESTAMPTZ,
  almoco_retorno TIMESTAMPTZ,
  saida TIMESTAMPTZ,
  saldo_minutos INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'completo', 'ausente', 'justificado')),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, data)
);

ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;

-- Tabela de justificativas
CREATE TABLE public.justificativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registro_ponto_id UUID REFERENCES public.registros_ponto(id),
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('falta', 'atraso', 'saida_antecipada', 'atestado', 'outros')),
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
  aprovado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.justificativas ENABLE ROW LEVEL SECURITY;

-- Tabela de ocorrências/aprovações
CREATE TABLE public.ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('hora_extra', 'banco_horas', 'advertencia', 'outros')),
  descricao TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
  aprovado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cargos_updated_at BEFORE UPDATE ON public.cargos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_escalas_updated_at BEFORE UPDATE ON public.escalas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_funcionarios_updated_at BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_registros_ponto_updated_at BEFORE UPDATE ON public.registros_ponto FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_justificativas_updated_at BEFORE UPDATE ON public.justificativas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ocorrencias_updated_at BEFORE UPDATE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'colaborador');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User Roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Cargos
CREATE POLICY "Authenticated can view cargos" ON public.cargos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage cargos" ON public.cargos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Escalas
CREATE POLICY "Authenticated can view escalas" ON public.escalas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage escalas" ON public.escalas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Funcionários
CREATE POLICY "Admins can view all funcionarios" ON public.funcionarios
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Users can view own funcionario" ON public.funcionarios
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage funcionarios" ON public.funcionarios
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Registros de ponto
CREATE POLICY "Admins can view all registros" ON public.registros_ponto
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Users can view own registros" ON public.registros_ponto
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own registros" ON public.registros_ponto
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own registros" ON public.registros_ponto
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage registros" ON public.registros_ponto
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Justificativas
CREATE POLICY "Users can view own justificativas" ON public.justificativas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all justificativas" ON public.justificativas
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Users can create own justificativas" ON public.justificativas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage justificativas" ON public.justificativas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Ocorrências
CREATE POLICY "Users can view own ocorrencias" ON public.ocorrencias
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all ocorrencias" ON public.ocorrencias
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Users can create own ocorrencias" ON public.ocorrencias
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage ocorrencias" ON public.ocorrencias
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
