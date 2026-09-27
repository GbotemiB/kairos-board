import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Cookie-less client for public reads (the board). Runs as the `anon` role, so
 * RLS limits it to visible programs. Use `createServerSupabase` for anything
 * that depends on the signed-in user.
 */
export function createPublicClient() {
  const { url, key } = getSupabaseConfig();

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
