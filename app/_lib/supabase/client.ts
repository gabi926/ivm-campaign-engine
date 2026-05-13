import { createBrowserClient } from "@supabase/ssr";

// Mirrors the portal's browser Supabase client. The shared `cookieOptions.domain`
// (e.g. `.ivm-agents.com`) means the auth cookie set by the portal is readable
// here — and any cookie this client refreshes during a render stays scoped to
// the same domain so the portal still sees it.
export function createClient() {
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain,
        path: "/",
        sameSite: "lax",
        secure:
          typeof window !== "undefined" && window.location.protocol === "https:",
      },
    },
  );
}
