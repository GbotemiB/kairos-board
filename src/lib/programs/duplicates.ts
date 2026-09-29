import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type ExistingProgram = { id: string; title: string };

/** Keeps a slow database from using up the extraction time budget. */
export const DUPLICATE_CHECK_TIMEOUT_MS = 2_000;

export type DuplicateCheckResult = { ok: true; existing: ExistingProgram | null } | { ok: false };

/**
 * Looks up a visible program by its normalized URL. Uses the `programs` table
 * because `programs_public` does not expose `url_normalized`.
 */
export async function findProgramByNormalizedUrl(
  client: SupabaseClient<Database>,
  normalizedUrl: string,
): Promise<DuplicateCheckResult> {
  const { data, error } = await client
    .from("programs")
    .select("id, title")
    .eq("url_normalized", normalizedUrl)
    // Also caps the client's automatic retries.
    .abortSignal(AbortSignal.timeout(DUPLICATE_CHECK_TIMEOUT_MS))
    .maybeSingle();

  if (error !== null) {
    console.error("Duplicate check failed", error);
    return { ok: false };
  }

  return { ok: true, existing: data };
}
