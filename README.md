# IVM Campaign Engine

Multi-channel direct-response campaign generator. Form inputs (client, offer, audience, channels) produce a JSON brief covering Big Idea, copy variations, channel-specific creative (paid social, search, programmatic, email, newsletter, SMS, organic), compliance flags, and a self-critique pass. Built for IVM internal use; powered by Claude Sonnet via the Anthropic API with web search enabled for live client + competitor research.

## Local setup

Requires Node 18.17+ (Next.js 16 minimum).

```bash
git clone <this-repo-url>
cd ivm-campaign-engine
npm install
cp .env.example .env.local
# edit .env.local and paste your key: ANTHROPIC_API_KEY=sk-ant-...
npm run dev
# open http://localhost:3000
```

## Deploy

Push the repo to GitHub, import into [Vercel](https://vercel.com/new), add `ANTHROPIC_API_KEY` as an environment variable in project settings, and deploy. Vercel detects Next.js automatically — no extra config required.

For internal-only access, enable Vercel Authentication: project settings → Deployment Protection → Vercel Authentication. Recommended for any deployment with billable API calls.

## Cost

Each generation calls Claude Sonnet with `max_tokens: 16000` and the web search tool enabled. Typical cost is **~$0.05–0.30 per campaign**, depending on output length and how many web searches the model runs (each search adds roughly $0.01 on top of token cost).

## Architecture

- `app/page.tsx` — client-side form + output rendering. Sends raw form inputs to `/api/generate` and renders the parsed JSON response.
- `app/api/generate/route.ts` — server-only route that validates inputs, builds the full prompt, and calls the Anthropic SDK. The API key never touches the browser.
- Server-side input caps: 2000 chars per text field, 4000 for `offer` and `competitors`.
- Soft rate limit: 10 generations per IP per hour. Resets per Vercel cold start; not a substitute for proper auth.
- Runtime: `nodejs` (not edge), max duration 60s (Vercel hobby tier ceiling).

## Swapping models

Edit `model: "claude-sonnet-4-5"` in `app/api/generate/route.ts`. Unpinned alias auto-updates within the major version.
