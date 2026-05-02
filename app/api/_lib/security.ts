import { NextRequest } from "next/server";

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

// Defense-in-depth Origin check. Browsers set Origin on cross-origin and same-origin
// fetch POSTs and a malicious site cannot spoof it from a browser. A determined
// non-browser attacker can forge it, so this is a soft guard layered under
// Vercel Authentication, not the primary control.
export function checkOrigin(req: NextRequest): { allowed: boolean; origin: string | null } {
  const origin = req.headers.get("origin");
  if (!origin) return { allowed: false, origin: null };

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return { allowed: false, origin };
  }

  const hostname = parsed.hostname;
  const host = parsed.host;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return { allowed: true, origin };
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && (host === vercelUrl || hostname === vercelUrl)) {
    return { allowed: true, origin };
  }

  if (hostname === "vercel.app" || hostname.endsWith(".vercel.app")) {
    return { allowed: true, origin };
  }

  const customAllowed = process.env.ALLOWED_ORIGIN;
  if (customAllowed) {
    let normalizedHostname = customAllowed;
    try {
      normalizedHostname = new URL(customAllowed).hostname;
    } catch {
      // not a URL, treat env value as a bare hostname
    }
    if (origin === customAllowed || host === customAllowed || hostname === normalizedHostname) {
      return { allowed: true, origin };
    }
  }

  return { allowed: false, origin };
}
