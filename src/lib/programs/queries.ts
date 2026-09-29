import type { SupabaseClient } from "@supabase/supabase-js";

import { PAGE_SIZE, statusesFor, toSearchPattern, type BoardFilters } from "@/lib/programs/filters";
import { toProgram, type Program } from "@/lib/programs/types";
import type { Database } from "@/lib/supabase/database.types";

export type BoardResult =
  { ok: true; programs: Program[]; total: number; page: number; pageCount: number } | { ok: false };

/** PostgREST: the requested range starts past the last row (HTTP 416). */
const RANGE_NOT_SATISFIABLE = "PGRST103";

function pageCountFor(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function boardQuery(client: SupabaseClient<Database>, filters: BoardFilters, head: boolean) {
  let query = client.from("programs_public").select("*", { count: "exact", head });

  const statuses = statusesFor(filters.status);
  if (statuses !== null) {
    query = query.in("status", statuses);
  }
  if (filters.types.length > 0) {
    query = query.in("type", filters.types);
  }
  const pattern = toSearchPattern(filters.q);
  if (pattern !== null) {
    query = query.or(`title.ilike.${pattern},organization.ilike.${pattern}`);
  }
  return query;
}

/**
 * One page of the board. "Deadline" sort groups open, then upcoming, then
 * closed (status_rank), soonest deadline first and undated last. "Newest"
 * sorts by when programs were added.
 */
export async function getBoardPrograms(
  client: SupabaseClient<Database>,
  filters: BoardFilters,
): Promise<BoardResult> {
  const query = boardQuery(client, filters, false);
  const ordered =
    filters.sort === "newest"
      ? query.order("created_at", { ascending: false })
      : query
          .order("status_rank", { ascending: true })
          .order("deadline", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, error, count } = await ordered.range(from, from + PAGE_SIZE - 1);

  if (error !== null && error.code === RANGE_NOT_SATISFIABLE) {
    // Past the last page (e.g. an old link): report an empty page with the real total.
    const head = await boardQuery(client, filters, true);
    if (head.error === null) {
      const total = head.count ?? 0;
      return { ok: true, programs: [], total, page: filters.page, pageCount: pageCountFor(total) };
    }
  }
  if (error !== null) {
    console.error("Failed to load board programs", error);
    return { ok: false };
  }

  const total = count ?? data.length;
  return {
    ok: true,
    programs: data.map(toProgram).filter((program) => program !== null),
    total,
    page: filters.page,
    pageCount: pageCountFor(total),
  };
}
