import { NextResponse } from "next/server";
import { createClient } from "@/app/_lib/supabase/server";

// Sign out the current session, then bounce back to the portal landing.
// We accept POST (from the header's <form>) and GET (for any link-driven
// flows). Both end in a 303 redirect — using the portal URL from env so the
// dev environment redirects to localhost:3000 instead of prod.
async function handle() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const portal = process.env.NEXT_PUBLIC_PORTAL_URL || "https://ivm-agents.com";
  return NextResponse.redirect(new URL("/", portal), { status: 303 });
}

export async function POST() {
  return handle();
}

export async function GET() {
  return handle();
}
