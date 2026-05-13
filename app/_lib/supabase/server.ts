import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client. `cookies()` is async in Next.js 16 — must await. The
// `cookieOptions.domain` mirrors the portal so token refreshes write back to
// the same shared cookie (Domain=.ivm-agents.com in production).
export async function createClient() {
  const cookieStore = await cookies();
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — cookies are read-only here.
            // The proxy refreshes the session cookie on every request,
            // so this silent failure is safe.
          }
        },
      },
      cookieOptions: {
        domain,
        path: "/",
        sameSite: "lax",
      },
    },
  );
}
