import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { ProgramFormValues } from "@/lib/programs/form";
import type { Database } from "@/lib/supabase/database.types";

export type ProgramRecord = Database["public"]["Tables"]["programs"]["Row"];

export type MySubmission = Pick<
  ProgramRecord,
  | "id"
  | "title"
  | "url"
  | "created_at"
  | "deadline"
  | "deadline_type"
  | "status_override"
  | "is_hidden"
>;

const uuidSchema = z.uuid();

export function isProgramId(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}

/** The user's own programs, newest first, including ones hidden by moderators. */
export async function getMySubmissions(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<{ ok: true; programs: MySubmission[] } | { ok: false }> {
  const { data, error } = await client
    .from("programs")
    .select("id, title, url, created_at, deadline, deadline_type, status_override, is_hidden")
    .eq("submitter_id", userId)
    .order("created_at", { ascending: false });

  if (error !== null) {
    console.error("Failed to load submissions", error);
    return { ok: false };
  }
  return { ok: true, programs: data };
}

/**
 * One of the user's own programs. Filters by submitter explicitly: RLS would
 * also return other users' visible programs, which must not be editable here.
 */
export async function getOwnProgram(
  client: SupabaseClient<Database>,
  userId: string,
  id: string,
): Promise<ProgramRecord | null> {
  if (!isProgramId(id)) {
    return null;
  }
  const { data, error } = await client
    .from("programs")
    .select("*")
    .eq("id", id)
    .eq("submitter_id", userId)
    .maybeSingle();

  if (error !== null) {
    console.error("Failed to load program", error);
    return null;
  }
  return data;
}

export function recordToFormValues(record: ProgramRecord): ProgramFormValues {
  return {
    url: record.url,
    title: record.title,
    organization: record.organization ?? "",
    type: record.type,
    opensAt: record.opens_at ?? "",
    deadline: record.deadline ?? "",
    deadlineType: record.deadline_type,
    eligibility: record.eligibility.join("\n"),
    location: record.location ?? "",
    field: record.field ?? "",
    funding: record.funding ?? "",
    applicationsClosed: record.status_override === "CLOSED",
  };
}
