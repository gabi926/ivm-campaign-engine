# Asset Generation + Content Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Higgsfield AI image/video generation per ad block to saved campaigns, with a private Supabase Storage backend and a filterable Content Library, on the `feat/asset-generation-library` branch. Do not push.

**Architecture:** New `generated_assets` table (own-rows RLS) + private `generated-assets` Supabase Storage bucket. A typed Higgsfield REST client centralizes auth (`Authorization: Key {KEY}:{SECRET}`) and a model-id map per (asset_type, generation_mode). Four API routes (`generate` / `status` / `[id]` / `list`) wrap submit + poll + download + serve. A client component mounts on the saved campaign detail view; two new pages render a grid + detail. Text-to-video is implemented as an internal two-stage chain (soul → dop) stored as a single asset row, with stage tracked in `metadata`.

**Tech Stack:** Next.js 16.2.4, React 19.2.4, @supabase/ssr 0.10.3, @supabase/supabase-js 2.105.4, lucide-react 1.14.0, Tailwind v4. No test runner — verification gate is `npm run build` + `npm run lint` per task, with the spec's integration test plan as final acceptance.

---

## File Structure

**Create:**
- `supabase/migrations/005_generated_assets.sql` — table, RLS, storage bucket, storage policies, indexes
- `app/_lib/asset-types.ts` — shared types for the feature
- `app/_lib/higgsfield.ts` — REST client (submit, poll, downloadAndStore, model map)
- `app/api/assets/generate/route.ts` — POST: validate, insert pending, submit to Higgsfield, return processing
- `app/api/assets/[id]/status/route.ts` — GET: poll Higgsfield, hydrate storage on complete, handle t2v stage chain
- `app/api/assets/[id]/route.ts` — GET (single) + DELETE (row + storage object)
- `app/api/assets/list/route.ts` — GET: filter by clientId/campaignId/type/status
- `app/components/GenerateAssetsButton.tsx` — saved-campaign panel: per-block buttons, modal, polling pill, thumbnails
- `app/library/page.tsx` — server-rendered filterable grid
- `app/library/LibraryGrid.tsx` — client interactivity (filters, fullscreen, delete confirm)
- `app/library/[id]/page.tsx` — server-rendered detail
- `app/library/[id]/LibraryDetailClient.tsx` — client viewer (player, download, delete, regenerate)

**Modify:**
- `app/history/[id]/page.tsx` — mount `<GenerateAssetsButton />` below `<CampaignReportView />`
- `app/components/PortalHeader.tsx` — add "Library" link between Revenue Engine logo and History

---

## Task 1: Migration — `005_generated_assets.sql`

**Files:**
- Create: `supabase/migrations/005_generated_assets.sql`

- [ ] **Step 1: Write the migration**

Full content includes: `CREATE TABLE public.generated_assets` with 19 columns, `ENABLE ROW LEVEL SECURITY`, 4 own-rows policies, 4 indexes (`user_created`, `campaign`, `client`, `status`), `INSERT INTO storage.buckets ... ON CONFLICT DO NOTHING`, 3 storage policies on `storage.objects` keyed by `(storage.foldername(name))[1] = auth.uid()::text`.

- [ ] **Step 2: Verify SQL parses (manual visual check; no DB connection from build)**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_generated_assets.sql
git commit -m "feat(assets): migration 005 — generated_assets table + storage bucket"
```

---

## Task 2: Shared types — `asset-types.ts`

**Files:**
- Create: `app/_lib/asset-types.ts`

- [ ] **Step 1: Write the types file**

Exports: `ASSET_TYPES`, `GENERATION_MODES`, `ASSET_STATUSES` const arrays + corresponding union types; `GeneratedAsset` (row shape); `AssetListItem` (list view); `GenerateAssetRequest` (POST body); `HiggsfieldSubmitResponse` and `HiggsfieldStatusResponse` (defensive, all fields optional).

- [ ] **Step 2: Run `npm run build` and confirm zero TS errors**
- [ ] **Step 3: Commit**

```bash
git add app/_lib/asset-types.ts
git commit -m "feat(assets): shared types for generated_assets feature"
```

---

## Task 3: Higgsfield client — `higgsfield.ts`

**Files:**
- Create: `app/_lib/higgsfield.ts`

- [ ] **Step 1: Write the client**

Constants: `HIGGSFIELD_API_BASE = "https://platform.higgsfield.ai"`. Auth header builder reads `HIGGSFIELD_API_KEY` and `HIGGSFIELD_SECRET`, returns `Key {key}:{secret}` (or `Key {key}` if secret empty) and throws if no key. Model map (frozen): `{ image: "higgsfield-ai/soul/standard", soul: "higgsfield-ai/soul/standard", "image-to-video": "higgsfield-ai/dop/standard", "text-to-video": <chain> }`.

Functions:
- `submitImageGeneration({ prompt, aspect_ratio, resolution, image_url? })` → POST `/higgsfield-ai/soul/standard` → `{ request_id, status, status_url? }`
- `submitVideoGeneration({ image_url, prompt, duration })` → POST `/higgsfield-ai/dop/standard` → same shape
- `pollGenerationStatus(request_id)` → GET `/requests/{id}/status` → defensive parse of `{ status, images?: [{url}], video?: {url}, image_url?, video_url?, error? }`; returns normalized `{ status, result_urls: string[], thumbnail_url?, error_message?, raw_metadata }`
- `downloadAndStore(sourceUrl, storagePath, contentType, supabase)` → fetch → upload to `generated-assets` bucket → `createSignedUrl(path, 604800)` → return `{ storage_path, storage_url }`
- `refreshSignedUrl(storagePath, supabase)` → re-signs if needed

Status normalization: `queued | in_progress` → `processing`; `completed` → `completed`; `nsfw` → `failed` with message; `failed` → `failed`. Timeouts: 60s submit, 30s poll, 120s download. 401/403 → throw with clear message. 429 → throw with `retry-after`.

- [ ] **Step 2: Run `npm run build` and `npm run lint`; fix any errors**
- [ ] **Step 3: Commit**

```bash
git add app/_lib/higgsfield.ts
git commit -m "feat(assets): higgsfield REST client (submit, poll, download, store)"
```

---

## Task 4: `POST /api/assets/generate`

**Files:**
- Create: `app/api/assets/generate/route.ts`

- [ ] **Step 1: Write the route**

Pattern matches `landing-pages/generate/route.ts`: `runtime="nodejs"`, `dynamic="force-dynamic"`, `maxDuration=60`. UUID regex. Auth gate via `getUser()`. Body validation: `campaign_id` UUID required; `asset_type ∈ {image,video}`; `generation_mode` valid; `prompt` non-empty string; sensible mode/type combination check (image cannot be t2v/i2v, etc.). Confirm campaign ownership via RLS-scoped `.maybeSingle()`. If `reference_image_ids` present, fetch their `storage_path` via RLS-scoped query, regenerate signed URL via `refreshSignedUrl`, take the first one.

Mode→action mapping:
- `image` / `text-to-image` → `submitImageGeneration({ prompt, aspect_ratio, resolution })`
- `image` / `soul` → `submitImageGeneration({ prompt, aspect_ratio, resolution, image_url: ref })`
- `video` / `image-to-video` → require `image_url` from refs; `submitVideoGeneration({ image_url, prompt, duration })`
- `video` / `text-to-video` → INTERNAL STAGE 1: `submitImageGeneration({ prompt, aspect_ratio, resolution })`; row's metadata records `{ stage: "image", image_request_id }`; the stage-2 dop submission happens in the status route once the image completes

Insert generated_assets row `status='pending'`. On Higgsfield submit success, UPDATE to `status='processing'` with `higgsfield_generation_id` set. Return `{ success, asset_id, status, generation_id }`. On Higgsfield failure, UPDATE row to `failed` with `error_message`, return 502. All logs prefixed `[assets/generate]`.

- [ ] **Step 2: Run `npm run build`; fix errors**
- [ ] **Step 3: Commit**

```bash
git add app/api/assets/generate/route.ts
git commit -m "feat(assets): POST /api/assets/generate — submit to Higgsfield"
```

---

## Task 5: `GET /api/assets/[id]/status`

**Files:**
- Create: `app/api/assets/[id]/status/route.ts`

- [ ] **Step 1: Write the route**

`runtime="nodejs"`, `dynamic="force-dynamic"`, `maxDuration=60`. Auth gate + UUID validation + RLS-scoped row fetch. If row is `completed` or `failed`, return as-is (but refresh signed URL if older than 6 days).

If `pending` or `processing`:
1. Call `pollGenerationStatus(higgsfield_generation_id)`.
2. If still processing → just bump `updated_at`, return current state.
3. If failed → update row to `failed` with `error_message` + metadata, return.
4. If completed:
   - **Text-to-video stage-1 transition:** if row's `metadata.stage === "image"` (still in image stage), download the image, store at `{user_id}/{client_or_unattached}/{campaign_or_none}/{image_request_id}.png`, then call `submitVideoGeneration({ image_url: signed_url, prompt, duration })`, update row to keep `status='processing'`, set `higgsfield_generation_id` to the new video request_id, and write metadata `{ stage: "video", image_request_id, video_request_id, intermediate_image_url, intermediate_storage_path }`. Return current processing state.
   - **All other completions (and text-to-video stage-2):** download result, upload to storage at `{user_id}/{client_or_unattached}/{campaign_or_none}/{request_id}.{ext}`, create signed URL (7 days), UPDATE row with `status='completed'`, `storage_path`, `storage_url`, `thumbnail_url` (if video poster available, else null), `completed_at`. Return updated row.

All logs prefixed `[assets/status]`. Response: `{ success: true, asset: GeneratedAsset }`.

- [ ] **Step 2: Run `npm run build`; fix errors**
- [ ] **Step 3: Commit**

```bash
git add app/api/assets/[id]/status/route.ts
git commit -m "feat(assets): GET /api/assets/[id]/status — poll + hydrate storage + t2v chain"
```

---

## Task 6: `GET/DELETE /api/assets/[id]`

**Files:**
- Create: `app/api/assets/[id]/route.ts`

- [ ] **Step 1: Write the route**

`runtime="nodejs"`, `dynamic="force-dynamic"`. Auth gate, UUID validation.
- **GET:** RLS-scoped select all columns by id; 404 if null; refresh signed URL if storage_url is from a >6-day-old signed URL (cheapest heuristic: if `completed_at` is more than 6 days ago and storage_path is set, regenerate signed URL via `refreshSignedUrl` and update the row).
- **DELETE:** Fetch row first (RLS-enforced). If `storage_path` set, attempt `supabase.storage.from('generated-assets').remove([storage_path])` in try/catch (log on failure but don't block). Then delete row. Return `{ success: true }`.

All logs prefixed `[assets/id]`.

- [ ] **Step 2: Build + commit**

```bash
git add app/api/assets/[id]/route.ts
git commit -m "feat(assets): GET + DELETE /api/assets/[id]"
```

---

## Task 7: `GET /api/assets/list`

**Files:**
- Create: `app/api/assets/list/route.ts`

- [ ] **Step 1: Write the route**

Pattern mirrors `landing-pages/list/route.ts`. Query params: `clientId`, `campaignId`, `assetType`, `status`. Select: `id, client_id, campaign_id, asset_type, generation_mode, status, storage_url, thumbnail_url, prompt, created_at, completed_at, ad_block_index, clients(name)`. Filters chain conditionally. Order: `created_at DESC`. Limit 100. Defensive client-join extraction (same `clientName(c)` helper). Response: `{ success: true, assets: AssetListItem[] }`. Logs prefixed `[assets/list]`.

- [ ] **Step 2: Build + commit**

```bash
git add app/api/assets/list/route.ts
git commit -m "feat(assets): GET /api/assets/list — filterable list"
```

---

## Task 8: `GenerateAssetsButton.tsx`

**Files:**
- Create: `app/components/GenerateAssetsButton.tsx`

- [ ] **Step 1: Write the component**

`"use client"`. Props: `{ campaignId, clientId, copyVariations: AdBlock[] }`. Panel header "GENERATE ASSETS" with stone border + accent dot. Per ad block: row with truncated headline + two buttons (🖼 Image / 🎬 Video).

State per block: `{ pending?: { assetId, type }, completed?: { assetId, storage_url, thumbnail_url, type }, error?: string }`, keyed by `${ad_block_index}:${asset_type}` so image and video for same block live independently.

Modal: prompt textarea pre-filled from `block.body || block.visual_direction || block.headline`. For video: extra `<select>` for `duration` (5/10) and `aspect_ratio` (16:9/9:16/1:1). Submit → POST `/api/assets/generate` → on success start polling.

Polling: `setInterval(5000)` calls `GET /api/assets/[id]/status`; on `completed` swap pill → thumbnail card; on `failed` swap → error pill with Retry button (reopens modal pre-filled). Cap at 60 polls (5 min); after that show "Still processing — check Library tab".

Thumbnail card: 64×64 cover, click → fullscreen modal (image: `<img>`; video: `<video controls>`). Download link uses `storage_url` directly.

Match GenerateBlueprintButton's class palette: `border border-stone-900`, `px-4 py-2.5`, `font-mono text-[10px] uppercase tracking-widest`, `hover:bg-stone-900 hover:text-white`.

- [ ] **Step 2: Build + commit**

```bash
git add app/components/GenerateAssetsButton.tsx
git commit -m "feat(assets): GenerateAssetsButton — per-block image/video panel + polling"
```

---

## Task 9: Mount on history detail

**Files:**
- Modify: `app/history/[id]/page.tsx`

- [ ] **Step 1: Import + render below CampaignReportView**

After `<CampaignReportView ... />`, render:

```tsx
{Array.isArray(row.campaign_json?.copy_variations) &&
  row.campaign_json.copy_variations.length > 0 && (
    <GenerateAssetsButton
      campaignId={row.id}
      clientId={row.client_id}
      copyVariations={row.campaign_json.copy_variations}
    />
  )}
```

Guard against missing `copy_variations` — render nothing if empty.

- [ ] **Step 2: Build + commit**

```bash
git add app/history/[id]/page.tsx
git commit -m "feat(assets): mount GenerateAssetsButton on saved campaign detail"
```

---

## Task 10: Library list page

**Files:**
- Create: `app/library/page.tsx` (server)
- Create: `app/library/LibraryGrid.tsx` (client)

- [ ] **Step 1: Server page**

`dynamic="force-dynamic"`. Auth via `requireAuth()`. Reads URL search params (`clientId`, `campaignId`, `type`, `status`) and passes to `<LibraryGrid initialFilters={...} />`. Header: "Content Library" + subtitle.

- [ ] **Step 2: Client grid**

`"use client"`. Initial fetch of `/api/assets/list` with filters. Filter bar: client dropdown (fetches `/api/assets/list?clientId=...` distinct or hardcoded "All"), campaign dropdown (cascades), type chips, status chips. On filter change → refetch + push URL state via `router.replace(...)`. Grid: 3-col desktop / 2-col mobile cards. Each card: thumbnail (image src=storage_url, video poster=thumbnail_url with play icon overlay), bottom footer with type icon + relative timestamp + status pill if not completed, hover overlay with truncated prompt. Top-right corner: download link + delete button (confirm modal → DELETE `/api/assets/[id]`). Click body → fullscreen modal.

Empty state: "No assets yet. Generate your first one from a saved campaign."

- [ ] **Step 3: Build + commit**

```bash
git add app/library/page.tsx app/library/LibraryGrid.tsx
git commit -m "feat(assets): /library list page with filters + grid"
```

---

## Task 11: Library detail page

**Files:**
- Create: `app/library/[id]/page.tsx` (server)
- Create: `app/library/[id]/LibraryDetailClient.tsx` (client)

- [ ] **Step 1: Server page**

Same UUID guard + RLS-scoped fetch pattern as blueprints/[id]/page.tsx. Fetches the asset + left-joined client name + campaign brand_name. `notFound()` on null. Renders `<LibraryDetailClient />`.

- [ ] **Step 2: Client detail**

Layout: 2-col (main + side panel). Main: full-size image or `<video controls>`. Side: prompt, mode, status, cost_credits, created_at, link to source campaign, full metadata (collapsed). Actions: Download (signed_url), Delete (confirm → DELETE → redirect to `/library`), Regenerate (POST `/api/assets/generate` with same params → push to new asset's detail).

- [ ] **Step 3: Build + commit**

```bash
git add app/library/[id]/page.tsx app/library/[id]/LibraryDetailClient.tsx
git commit -m "feat(assets): /library/[id] detail page"
```

---

## Task 12: Nav update

**Files:**
- Modify: `app/components/PortalHeader.tsx`

- [ ] **Step 1: Add "Library" link**

Insert between History and the right-aligned section (or right after History in the left flex group):

```tsx
<Link href="/library" className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition">
  Library
</Link>
```

Also add "Blueprints" if it's missing — check current state (spec says to insert Library "between Blueprints and any other items"; if Blueprints isn't already in nav, add both).

- [ ] **Step 2: Build + commit**

```bash
git add app/components/PortalHeader.tsx
git commit -m "feat(assets): add Library nav link"
```

---

## Task 13: Final verification + deliverables

- [ ] **Step 1:** `npm run build` — zero errors, zero TS warnings related to new code
- [ ] **Step 2:** `npm run lint` — zero new violations
- [ ] **Step 3:** Verify `git log feat/asset-generation-library --oneline` shows the task commits cleanly
- [ ] **Step 4:** Write deviations summary + test plan recap to the chat (NOT committed)
- [ ] **Step 5:** Confirm branch is local-only (no push)

---

## Deviations log (to be filled during execution)

- **Higgsfield base URL:** `https://platform.higgsfield.ai` (no `/v1`) — spec guessed `/v1`. Verified via Higgsfield docs.
- **Higgsfield auth header:** `Authorization: Key {key}:{secret}` — spec said `Bearer`. `HIGGSFIELD_SECRET` is required; if empty we send `Key {key}` and log a warning (likely 401).
- **Model selection in URL path:** Higgsfield requires `model_id` in the URL. No user-facing picker; internal defaults: `higgsfield-ai/soul/standard` for image+soul, `higgsfield-ai/dop/standard` for image-to-video.
- **Text-to-video:** No documented pure t2v model. Implemented as internal soul → dop two-stage chain, one asset row, stage tracked in metadata.
- **`nsfw` status mapping:** Treated as `failed` with message "Content failed moderation (credits refunded)".
- **Storage bucket via SQL:** Uses `ON CONFLICT DO NOTHING`. If the Supabase project gates bucket creation via SQL, Gabi creates `generated-assets` (private) via Dashboard manually, then the migration's policy section runs cleanly on re-run.
- **`.env.example` live secrets:** Pre-existing, not introduced by this build. Flagged in final deliverables — sanitize before any push.
