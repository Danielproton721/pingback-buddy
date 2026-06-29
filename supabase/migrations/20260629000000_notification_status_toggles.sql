-- Liga/desliga a notificação por status (Pago / Pendente)
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS paid_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pending_enabled boolean NOT NULL DEFAULT true;
