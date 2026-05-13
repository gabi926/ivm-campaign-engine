# IVM Revenue Engine

Multi-channel direct-response campaign generator (a.k.a. "Revenue Engine"). Form inputs (client, offer, audience, channels) produce a JSON brief covering Big Idea, copy variations, channel-specific creative (paid social, search, programmatic, email, newsletter, SMS, organic), compliance flags, and a self-critique pass. Powered by Claude Sonnet via the Anthropic API with web search enabled for live client + competitor research.

Lives at [revenue-engine.ivm-agents.com](https://revenue-engine.ivm-agents.com), gated behind the IVM portal at [ivm-agents.com](https://ivm-agents.com).

## Portal auth integration

This tool has no login screen of its own — auth lives at the portal. The portal sets a Supabase session cookie scoped to `.ivm-agents.com`, which this subdomain reads. Flow:

- Authed user clicks "Launch Revenue Engine" from the portal dashboard → lands here, instantly authenticated.
- Direct visitor with no cookie → redirected to `https://ivm-agents.com/login?returnUrl=...`; after sign-in, portal sends them straight back here.
- Every page calls `requireAuth()` in the root layout as defense-in-depth on top of the [proxy.ts](proxy.ts) route protection.
- Direct API hits without a session get a clean `401 Unauthorized` JSON response (no HTML redirect — useful for curl, scripts, future integrations).
- The persistent header shows the logged-in user's email, a "Back to Portal" link, and a logout button. Logout signs out via Supabase and bounces to the portal landing.

Reference implementation lives in the portal repo at `c:\IVM\ivm-agents` — files mirrored here are [app/_lib/supabase/](app/_lib/supabase/), [app/_lib/auth.ts](app/_lib/auth.ts), and [proxy.ts](proxy.ts).

## Local setup

Requires Node 18.17+ (Next.js 16 minimum).

```bash
git clone <this-repo-url>
cd ivm-campaign-engine
npm install
cp .env.example .env.local
# edit .env.local — see env-var list below
npm run dev
```

The dev server picks a port — Next will say `Ready on http://localhost:3000` or whichever port is free. Open it in a browser.

### Env vars

All four are required (plus `ANTHROPIC_API_KEY`). Pull the Supabase values from the same project the portal uses:

| Var | Where | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com | Server-only |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL | Must match portal |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → anon/public key | Must match portal |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | leave **unset** locally; `.ivm-agents.com` in prod | Enables cross-subdomain cookie sharing |
| `NEXT_PUBLIC_PORTAL_URL` | `http://localhost:3000` (local) / `https://ivm-agents.com` (prod) | Used for redirects, header "Back to Portal" link, and logout target |

### Local testing — important quirk

**Browsers do not share cookies across ports on localhost.** Even with the cookie domain unset, the portal at `localhost:3000` and Revenue Engine at e.g. `localhost:3001` won't see each other's cookies. Two ways around it:

1. **Test against prod portal.** Set `NEXT_PUBLIC_PORTAL_URL=https://ivm-agents.com` in `.env.local` and log in at the prod portal. The cookie still won't share with localhost (different domain), but you can verify the redirect-to-portal flow works correctly.
2. **Stage a custom local domain.** Add `127.0.0.1 portal.local revenue-engine.local` to your hosts file, then set `NEXT_PUBLIC_COOKIE_DOMAIN=.local` and run both apps. End-to-end local auth works.

Day-to-day, option 1 is enough for any change that doesn't actually touch the auth flow.

## Deploy

Push to GitHub → import into Vercel → add all five env vars in project settings → deploy. The cookie domain in production must be `.ivm-agents.com` for the portal's session cookie to be readable. No Vercel deployment protection needed — the proxy + portal auth are the gate.

## Cost

Each generation calls Claude Sonnet with `max_tokens: 16000` and the web search tool enabled. Typical cost is **~$0.05–0.30 per campaign**, depending on output length and how many web searches the model runs (each search adds roughly $0.01 on top of token cost).

## Architecture

- [app/page.tsx](app/page.tsx) — client-side form + output rendering. Sends raw form inputs to `/api/generate` and renders the parsed JSON response.
- [app/api/generate/route.ts](app/api/generate/route.ts) — server-only route that validates inputs, builds the full prompt, and calls the Anthropic SDK. The API key never touches the browser.
- [app/api/download-pdf/route.tsx](app/api/download-pdf/route.tsx) — POST handler that renders the campaign output to a PDF via `@react-pdf/renderer`.
- [app/api/auth/logout/route.ts](app/api/auth/logout/route.ts) — POST/GET signs out the Supabase session, redirects to the portal landing.
- [proxy.ts](proxy.ts) — Next.js 16 proxy. Validates the session on every request. HTML routes get redirected to portal login; API routes get 401 JSON. `/api/auth/*` is exempt.
- [app/_lib/supabase/](app/_lib/supabase/) — browser / server / proxy-helper Supabase clients. All scoped to `NEXT_PUBLIC_COOKIE_DOMAIN`.
- [app/_lib/auth.ts](app/_lib/auth.ts) — `getUser` / `getProfile` / `requireAuth`. All wrapped in React `cache()` so a single render doesn't re-hit Supabase.
- [app/components/PortalHeader.tsx](app/components/PortalHeader.tsx) — sticky top header. Shows user email, Back-to-Portal link, Logout button.

Defense in depth: the proxy is for optimistic checks per the Next.js docs ([app/api-reference/file-conventions/proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)). The root layout also calls `requireAuth()` so a misconfigured matcher cannot leak a page render.

Server-side input caps: 2000 chars per text field, 4000 for `offer` and `competitors`. Soft rate limit: 10 generations per IP per hour, reset per cold start (not a substitute for proper auth). Runtime: `nodejs` (not edge), max duration 300s.

## Swapping models

Edit `model: "claude-sonnet-4-5"` in `app/api/generate/route.ts`. Unpinned alias auto-updates within the major version.
