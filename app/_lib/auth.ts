import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/app/_lib/supabase/server";

export type UserRole = "admin" | "team" | "client";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
};

// getUser() — verified with the Supabase auth server (not just the cookie).
// Use this anywhere you need to confirm "the request really is from this
// user." React `cache()` dedupes inside a single render.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// getProfile() — fetches the user_profiles row keyed by auth user id.
// Returns null when there is no session or the row is missing. The portal's
// trigger on auth.users insert keeps user_profiles in lockstep, so the
// missing-row case should only happen during an in-flight invite.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();
  if (error) {
    console.error("[auth] failed to load user_profiles row", error);
    return null;
  }
  return data as Profile;
});

// Build the portal login URL with a returnUrl pointing back at the page the
// caller was trying to reach. Used by both the proxy (cross-app redirect on
// missing cookie) and the layout (defense-in-depth re-validation).
export async function buildPortalLoginUrl(currentPath?: string): Promise<string> {
  const portal = process.env.NEXT_PUBLIC_PORTAL_URL || "https://ivm-agents.com";
  // In a Server Component we don't have direct access to the full request URL.
  // Reconstruct the origin from the Host header so the returnUrl points back
  // to this engine on whatever host the user actually visited.
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";
  const path = currentPath || "/";
  const returnUrl = origin ? `${origin}${path}` : path;
  const url = new URL("/login", portal);
  url.searchParams.set("returnUrl", returnUrl);
  return url.toString();
}

// requireAuth() — Server Component / Server Action guard. Redirects to the
// portal's login page when there is no verified session. Caller never
// receives a null user back.
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    const loginUrl = await buildPortalLoginUrl();
    redirect(loginUrl);
  }
  return user;
}
