-- Cor personalizada do cartão do gateway (chave da paleta, ex: "violet")
ALTER TABLE public.gateway_configs
  ADD COLUMN IF NOT EXISTS color text;
