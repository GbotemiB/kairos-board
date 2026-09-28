import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/** Pages that need a signed-in user. The page itself re-checks (see requireUser). */
const PROTECTED_PREFIXES = ["/submit"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the auth session cookie before the request is rendered, so Server
 * Components always see a valid session. Also redirects signed-out visitors
 * away from protected pages before any HTML streams (an optimistic check).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();

  const supabase = createServerClient<Database>(url, key, {
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
        // Stops CDNs from caching a response that carries a session token.
        for (const [header, value] of Object.entries(headers)) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // Validates the JWT and refreshes it if needed. Do not remove.
  const { data } = await supabase.auth.getClaims();
  const signedIn = typeof data?.claims.sub === "string";

  if (!signedIn && isProtected(request.nextUrl.pathname)) {
    // Built fresh: nextUrl.clone() would carry over trailing-slash formatting.
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(login);
    // Keep any cookie changes (e.g. a cleared expired session).
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}
