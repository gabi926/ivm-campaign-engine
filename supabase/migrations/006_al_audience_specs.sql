-- 006_al_audience_specs.sql
-- D2 — AL Audience Builder: persistent storage for generated audience specs.
--
-- DO NOT auto-run. Paste into Supabase SQL Editor on the portal project.
-- RLS mirrors campaigns (003): insert checks user_id = auth.uid();
-- SELECT allows owner OR admin/team role OR mapped client via user_clients.
-- This keeps the Revenue Engine's data model coherent — audiences and the
-- campaigns they pair with follow the same visibility rules.

CREATE TABLE IF NOT EXISTS public.al_audience_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,

  -- Inputs (captured for audit / re-run).
  icp_brief TEXT NOT NULL,
  offer TEXT,
  geography TEXT NOT NULL DEFAULT 'United States',

  -- Spec-level summary fields hoisted to columns for cheap listing /
  -- filtering. Full spec lives in generated_spec JSONB below.
  audience_name TEXT,
  detected_type TEXT,

  -- The Claude-generated spec. Shape mirrors the ALAudienceSpec interface
  -- in app/_lib/al-taxonomy/types.ts.
  generated_spec JSONB NOT NULL,

  -- Provenance / cost tracking.
  model_used TEXT NOT NULL,
  candidate_count INT,
  prompt_tokens INT,
  completion_tokens INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.al_audience_specs ENABLE ROW LEVEL SECURITY;

-- RLS: insert only when the row's user_id matches the authenticated user.
DROP POLICY IF EXISTS "users_insert_own_al_specs" ON public.al_audience_specs;
CREATE POLICY "users_insert_own_al_specs"
  ON public.al_audience_specs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS: read either own rows, OR everything if admin/team, OR rows linked to
-- a client the reader is mapped to via user_clients. Mirrors campaigns (003).
DROP POLICY IF EXISTS "users_read_al_specs" ON public.al_audience_specs;
CREATE POLICY "users_read_al_specs"
  ON public.al_audience_specs FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'team')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_clients
      WHERE user_clients.client_id = al_audience_specs.client_id
        AND user_clients.user_id = auth.uid()
    )
  );

-- Hot path: history list query is ordered by created_at DESC per user.
CREATE INDEX IF NOT EXISTS idx_al_specs_user_created
  ON public.al_audience_specs(user_id, created_at DESC);

-- Client-scoped reads (e.g. "show all audiences built for client X").
CREATE INDEX IF NOT EXISTS idx_al_specs_client
  ON public.al_audience_specs(client_id);
