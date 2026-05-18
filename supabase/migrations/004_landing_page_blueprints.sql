-- Revenue Engine — Landing Page Blueprint Generator (Day 004).
--
-- DO NOT auto-run. Paste into Supabase SQL Editor on the portal project.
--
-- RLS is strict own-rows-only (per Chunk A spec — mirrors capi_setups in the
-- Audit Engine repo), NOT the broader owner/admin/team/mapped-client pattern
-- used by the campaigns table. Blueprints are an operator working artifact.

CREATE TABLE IF NOT EXISTS public.landing_page_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  target_builder TEXT NOT NULL,                 -- 'ghl' | 'lovable' | 'generic'
  blueprint_data JSONB NOT NULL,                -- full structured blueprint
  builder_prompt TEXT NOT NULL,                 -- paste-ready prompt for the builder
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.landing_page_blueprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON public.landing_page_blueprints;
DROP POLICY IF EXISTS "users_insert_own" ON public.landing_page_blueprints;
DROP POLICY IF EXISTS "users_update_own" ON public.landing_page_blueprints;
DROP POLICY IF EXISTS "users_delete_own" ON public.landing_page_blueprints;

CREATE POLICY "users_select_own"
  ON public.landing_page_blueprints FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own"
  ON public.landing_page_blueprints FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own"
  ON public.landing_page_blueprints FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own"
  ON public.landing_page_blueprints FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_lp_blueprints_user_created
  ON public.landing_page_blueprints(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lp_blueprints_client
  ON public.landing_page_blueprints(client_id);
