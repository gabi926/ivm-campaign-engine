import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/app/_lib/supabase/session";

// Route protection for the entire Revenue Engine. Anything reaching this
// proxy that isn't statically excluded by the matcher needs a verified
// portal session. Two response shapes:
//
//   - HTML/page requests without a session  →  302 redirect to the portal
//     login page with `returnUrl` set to the page they were trying to reach.
//   - API requests without a session         →  401 JSON. A redirect is
//     useless for fetch/curl clients and would corrupt their response
//     parsing.
//
// /api/auth/* is exempt — the logout endpoint specifically needs to run
// without raising the redirect (the user is in the act of leaving).
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  // Always allow the local logout / future auth-related routes through.
  if (path.startsWith("/api/auth/")) {
    return response;
  }

  if (!user) {
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized. Sign in at the IVM portal." },
        { status: 401 },
      );
    }

    const portal = process.env.NEXT_PUBLIC_PORTAL_URL || "https://ivm-agents.com";
    const origin = request.nextUrl.origin;
    const returnUrl = `${origin}${path}${request.nextUrl.search}`;
    const loginUrl = new URL("/login", portal);
    loginUrl.searchParams.set("returnUrl", returnUrl);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on every path except static asset routes. We intentionally include
  // /api/* so direct API hits without a session get a clean 401.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
