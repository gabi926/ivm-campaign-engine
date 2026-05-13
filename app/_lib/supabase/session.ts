import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

// Canonical @supabase/ssr proxy helper. Reads the request's cookies, calls
// getUser() (which validates against the auth server, not just decodes the
// cookie), and writes any refreshed cookies onto the response.
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              response.headers.set(key, value);
            }
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
