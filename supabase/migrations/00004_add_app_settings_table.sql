
-- Store platform-wide configuration (e.g. platform owner account)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only authenticated users with the service role can modify settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed by Edge Functions and client)
CREATE POLICY "Public can read settings"
  ON public.app_settings FOR SELECT
  USING (true);

-- Only service role can insert/update (managed via SQL, not client)
CREATE POLICY "Service role only writes"
  ON public.app_settings FOR ALL
  USING (auth.role() = 'service_role');
