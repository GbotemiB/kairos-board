import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/** Extraction attempts allowed per user per window. Protects the shared Gemini quota. */
export const EXTRACTIONS_PER_WINDOW = 10;
export const WINDOW_MS = 60 * 60 * 1000;

export type ExtractionOutcome = Database["public"]["Tables"]["extraction_logs"]["Row"]["outcome"];

export type RateLimitResult =
  | { ok: true; allowed: true; remaining: number }
  | { ok: true; allowed: false; retryAfterSeconds: number }
  | { ok: false };

/**
 * Counts the user's attempts in the last window. RLS limits the query to the
 * user's own rows; the explicit filter keeps intent clear.
 */
export async function checkRateLimit(
  client: SupabaseClient<Database>,
  userId: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const { data, error } = await client
    .from("extraction_logs")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", new Date(now - WINDOW_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(EXTRACTIONS_PER_WINDOW);

  if (error !== null) {
    console.error("Rate limit check failed", error);
    return { ok: false };
  }

  if (data.length < EXTRACTIONS_PER_WINDOW) {
    return { ok: true, allowed: true, remaining: EXTRACTIONS_PER_WINDOW - data.length };
  }

  // The oldest attempt in the window is the next to expire.
  const oldest = Date.parse(data[0].created_at);
  const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
  return { ok: true, allowed: false, retryAfterSeconds };
}

/** Records an attempt. Failures are logged, never thrown: the user's result matters more. */
export async function recordExtraction(
  client: SupabaseClient<Database>,
  normalizedUrl: string,
  outcome: ExtractionOutcome,
): Promise<void> {
  const { error } = await client
    .from("extraction_logs")
    .insert({ url_normalized: normalizedUrl.slice(0, 2048), outcome });
  if (error !== null) {
    console.error("Failed to record extraction", error);
  }
}
