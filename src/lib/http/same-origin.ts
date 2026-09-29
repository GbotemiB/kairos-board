import type { NextRequest } from "next/server";

/**
 * The host the browser asked for. Behind a proxy (Netlify), `nextUrl.host` is
 * the internal host, so prefer the forwarded host, then Host (as Next.js does
 * for its own Server Action CSRF check).
 */
export function requestedHost(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("host") || request.nextUrl.host).toLowerCase();
}

/**
 * Blocks cross-site requests. JSON-only bodies already force a CORS preflight;
 * checking Origin covers browsers and proxies that send it anyway.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) {
    return true;
  }
  try {
    return new URL(origin).host.toLowerCase() === requestedHost(request);
  } catch {
    return false;
  }
}
