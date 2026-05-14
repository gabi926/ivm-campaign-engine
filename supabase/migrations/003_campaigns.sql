-- Revenue Engine — campaigns save layer (Day 003).
--
-- DO NOT auto-run. Paste into Supabase SQL Editor on the portal project.
-- RLS policies mirror audit_runs: owner sees own rows; admin/team see all;
-- mapped client users see rows where campaigns.client_id matches their
-- user_clients entry.
--
-- Foreign key constraint name `campaigns_client_id_fkey` is the Postgres
-- default for <table>_<column>_fkey and is referenced by the history list
-- page's embedded resource select.

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  brand_name TEXT,
  website TEXT,
  offer TEXT,
  primary_cta TEXT,
  target_audience TEXT,
  brand_voice TEXT,
  competitors TEXT,
  channels TEXT[] NOT NULL DEFAULT '{}',
  campaign_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS: insert only when row's user_id matches the authenticated user.
DROP POLICY IF EXISTS "users_insert_own_campaigns" ON public.campaigns;
CREATE POLICY "users_insert_own_campaigns"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS: read either own rows, OR everything if admin/team, OR rows linked to
-- a client the reader is mapped to via user_clients.
DROP POLICY IF EXISTS "users_read_campaigns" ON public.campaigns;
CREATE POLICY "users_read_campaigns"
  ON public.campaigns FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'team')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_clients
      WHERE user_clients.client_id = campaigns.client_id
        AND user_clients.user_id = auth.uid()
    )
  );

-- Hot path: history list query is ordered by created_at DESC per user.
CREATE INDEX IF NOT EXISTS idx_campaigns_user_created
  ON public.campaigns(user_id, created_at DESC);
