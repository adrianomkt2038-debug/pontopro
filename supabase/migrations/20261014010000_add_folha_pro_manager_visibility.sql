-- Add the administrator-controlled visibility switch for Folha Pro.
-- Defaults to visible for gestores to preserve the current requested behavior.
INSERT INTO public.configuracoes_sistema (chave, valor, tipo, descricao)
VALUES (
  'folha_pro_visivel_gestores',
  'true',
  'boolean',
  'Exibir o botão Folha Pro na navegação dos gestores. Administradores sempre veem o botão.'
)
ON CONFLICT (chave) DO NOTHING;
