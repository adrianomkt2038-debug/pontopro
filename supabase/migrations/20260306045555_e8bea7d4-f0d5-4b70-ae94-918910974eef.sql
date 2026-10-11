
CREATE TABLE public.configuracoes_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text NOT NULL DEFAULT 'false',
  tipo text NOT NULL DEFAULT 'boolean',
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage configuracoes_sistema"
  ON public.configuracoes_sistema FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view configuracoes_sistema"
  ON public.configuracoes_sistema FOR SELECT
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_configuracoes_sistema_updated_at
  BEFORE UPDATE ON public.configuracoes_sistema
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO public.configuracoes_sistema (chave, valor, tipo, descricao) VALUES
  ('permitir_auto_cadastro', 'true', 'boolean', 'Permitir que novos usuários se cadastrem no sistema'),
  ('role_padrao_novos_usuarios', 'colaborador', 'select', 'Papel padrão atribuído a novos usuários'),
  ('exigir_confirmacao_email', 'false', 'boolean', 'Exigir confirmação de e-mail antes do primeiro acesso'),
  ('permitir_registro_sem_escala', 'true', 'boolean', 'Permitir registro de ponto para usuários sem escala vinculada'),
  ('tempo_sessao_minutos', '480', 'number', 'Tempo máximo de sessão em minutos (padrão: 8 horas)'),
  ('notificar_admin_novo_cadastro', 'true', 'boolean', 'Notificar administradores quando um novo usuário se cadastrar');
