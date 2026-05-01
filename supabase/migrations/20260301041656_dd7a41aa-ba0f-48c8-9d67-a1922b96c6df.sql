ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS paid_title text DEFAULT 'Pagamento confirmado',
  ADD COLUMN IF NOT EXISTS paid_message text DEFAULT '{customer} - R$ {amount} - {product} via {method}',
  ADD COLUMN IF NOT EXISTS pending_title text DEFAULT 'Novo pagamento',
  ADD COLUMN IF NOT EXISTS pending_message text DEFAULT '{customer} - R$ {amount} - {product} via {method}';