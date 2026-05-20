// Sticky header rendered on every page of the Revenue Engine. Receives the
// authenticated email server-side from the root layout and ships only the
// logout form as a tiny client island. No client-side auth state — the
// layout has already established it before this component renders.

import Link from "next/link";

const ACCENT = "#d4ff3d";

export function PortalHeader({ email }: { email: string }) {
  const portal = process.env.NEXT_PUBLIC_PORTAL_URL || "https://ivm-agents.com";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-300 px-5 md:px-8 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 md:gap-6">
        <Link
          href="/"
          className="font-mono uppercase tracking-widest text-xs md:text-sm font-bold text-stone-900 flex items-center gap-2 hover:opacity-80 transition"
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: ACCENT }}
          />
          Revenue Engine
        </Link>
        <Link
          href="/history"
          className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition"
        >
          History
        </Link>
        <Link
          href="/blueprints"
          className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition"
        >
          Blueprints
        </Link>
        <Link
          href="/library"
          className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition"
        >
          Library
        </Link>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        <span className="hidden sm:inline font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-stone-500 truncate max-w-[220px] md:max-w-none">
          {email}
        </span>
        <Link
          href={`${portal}/dashboard`}
          className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition"
        >
          ← Back to Portal
        </Link>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest font-bold text-stone-900 border border-stone-900 px-3 py-1.5 hover:bg-stone-900 hover:text-white transition"
          >
            Logout
          </button>
        </form>
      </div>
    </header>
  );
}
