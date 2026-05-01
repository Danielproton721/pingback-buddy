
-- System config table for storing VAPID keys (service_role only)
CREATE TABLE public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only service_role can access
CREATE POLICY "Service role can manage system config"
  ON public.system_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);
