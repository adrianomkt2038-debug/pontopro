-- Add a persisted, administrator-editable external URL for the Folha Pro sidebar button.
INSERT INTO public.configuracoes_sistema (chave, valor, tipo, descricao)
VALUES (
  'folha_pro_url',
  '',
  'url',
  'Endereço HTTPS externo aberto pelo botão Folha Pro na barra lateral'
)
ON CONFLICT (chave) DO NOTHING;
