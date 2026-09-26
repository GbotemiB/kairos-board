import type { SupabaseClient } from "@supabase/supabase-js";

import { toProgram, type Program, type ProgramStatus } from "@/lib/programs/types";
import type { Database } from "@/lib/supabase/database.types";

/** Upper bound until pagination lands (M4). */
export const BOARD_LIMIT = 100;

const STATUS_ORDER: Record<ProgramStatus, number> = { OPEN: 0, UPCOMING: 1, CLOSED: 2 };

export type BoardResult = { ok: true; programs: Program[] } | { ok: false };

/**
 * Board order: open, then upcoming, then closed. Within each group, soonest
 * deadline first and undated programs last.
 */
export async function getBoardPrograms(client: SupabaseClient<Database>): Promise<BoardResult> {
  const { data, error } = await client
    .from("programs_public")
    .select("*")
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(BOARD_LIMIT);

  if (error !== null) {
    console.error("Failed to load board programs", error);
    return { ok: false };
  }

  const programs = data.map(toProgram).filter((program) => program !== null);
  // Array.prototype.sort is stable, so the deadline order is kept within each status.
  programs.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return { ok: true, programs };
}
