import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Session-aware client for Server Components, Server Actions and Route
 * Handlers. Create one per request; never share it.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();

  return createServerClient<Database>(url, key, {
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
          // Server Components cannot set cookies. The proxy refreshes the
          // session on every request, so this is safe to ignore there.
        }
      },
    },
  });
}
