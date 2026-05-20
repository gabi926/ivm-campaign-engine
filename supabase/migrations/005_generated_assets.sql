-- Revenue Engine — Asset Generation + Content Library (Day 005).
--
-- DO NOT auto-run. Paste into Supabase SQL Editor on the portal project.
--
-- Adds the `generated_assets` table (own-rows RLS, mirrors 004) and a private
-- Supabase Storage bucket `generated-assets` for Higgsfield AI outputs.
--
-- BUCKET CREATION FALLBACK: if `INSERT INTO storage.buckets` is rejected by
-- the project's storage role (some Supabase projects require Dashboard-only
-- bucket creation), create the bucket manually:
--     Supabase Dashboard → Storage → New bucket → name: generated-assets,
--     public: OFF. Then re-run this migration — the bucket insert is a no-op
--     via ON CONFLICT DO NOTHING and the policy section runs cleanly.

-- ============================================================================
-- 1. TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.generated_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ad_block_index INTEGER,                        -- which copy_variation index, nullable
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'video')),
  generation_mode TEXT NOT NULL CHECK (
    generation_mode IN ('text-to-image', 'text-to-video', 'image-to-video', 'soul')
  ),
  prompt TEXT NOT NULL,
  reference_image_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  higgsfield_generation_id TEXT,                 -- Higgsfield request_id (or current stage's id for t2v chain)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  storage_path TEXT,                             -- raw path within `generated-assets` bucket
  storage_url TEXT,                              -- 7-day signed Supabase Storage URL
  thumbnail_url TEXT,                            -- video poster frame (nullable)
  error_message TEXT,
  cost_credits NUMERIC,                          -- Higgsfield credit cost if returned
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,   -- raw response + t2v stage tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- 2. ROW-LEVEL SECURITY (strict own-rows-only, mirrors 004)
-- ============================================================================
ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON public.generated_assets;
DROP POLICY IF EXISTS "users_insert_own" ON public.generated_assets;
DROP POLICY IF EXISTS "users_update_own" ON public.generated_assets;
DROP POLICY IF EXISTS "users_delete_own" ON public.generated_assets;

CREATE POLICY "users_select_own"
  ON public.generated_assets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own"
  ON public.generated_assets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own"
  ON public.generated_assets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own"
  ON public.generated_assets FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_generated_assets_user_created
  ON public.generated_assets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_assets_campaign
  ON public.generated_assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_client
  ON public.generated_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_status
  ON public.generated_assets(status);

-- ============================================================================
-- 4. STORAGE BUCKET (private; signed URLs only)
-- ============================================================================
-- Fallback safe: if the role lacks privilege to insert into storage.buckets,
-- create the bucket via Dashboard (Storage → New bucket → name=generated-assets,
-- public OFF) and re-run only sections 5 below.
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-assets', 'generated-assets', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. STORAGE OBJECT POLICIES (own-folder-only)
-- Path convention: {user_id}/{client_id||'unattached'}/{campaign_id||'no-campaign'}/{request_id}.{ext}
-- We gate on the first folder segment being the calling user's auth.uid().
-- ============================================================================
DROP POLICY IF EXISTS "assets_storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "assets_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "assets_storage_delete_own" ON storage.objects;

CREATE POLICY "assets_storage_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generated-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "assets_storage_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'generated-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "assets_storage_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'generated-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
