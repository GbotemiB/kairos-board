"use server";

import { redirect } from "next/navigation";

import type { SaveProgramState } from "@/app/submit/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { parseProgramForm, readFormValues } from "@/lib/programs/form";
import { isProgramId } from "@/lib/programs/mine";
import { createServerSupabase } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";

/** Bound to a program id: `updateProgram.bind(null, id)`. */
export async function updateProgram(
  id: string,
  previous: SaveProgramState,
  formData: FormData,
): Promise<SaveProgramState> {
  const values = readFormValues(formData);
  const attempt = (previous.attempt ?? 0) + 1;

  const user = await getCurrentUser();
  if (user === null) {
    return { error: "Your session has expired. Please sign in again.", values, attempt };
  }
  if (!isProgramId(id)) {
    return { error: "This program could not be found.", values, attempt };
  }

  const parsed = parseProgramForm(values);
  if (!parsed.ok) {
    return { fieldErrors: parsed.fieldErrors, values, attempt };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("programs")
    .update(parsed.program)
    .eq("id", id)
    .eq("submitter_id", user.id)
    .select("id");

  if (error !== null) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "Another program on the board already uses this link.", values, attempt };
    }
    console.error("Failed to update program", error);
    return { error: "Couldn't save your changes. Please try again.", values, attempt };
  }
  if (data.length === 0) {
    return { error: "This program could not be found.", values, attempt };
  }

  redirect("/my?updated=1");
}

export type DeleteProgramState = { error?: string };

/** Bound to a program id: `deleteProgram.bind(null, id)`. */
export async function deleteProgram(id: string): Promise<DeleteProgramState> {
  const user = await getCurrentUser();
  if (user === null) {
    return { error: "Your session has expired. Please sign in again." };
  }
  if (!isProgramId(id)) {
    return { error: "This program could not be found." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("programs")
    .delete()
    .eq("id", id)
    .eq("submitter_id", user.id)
    .select("id");

  if (error !== null) {
    console.error("Failed to delete program", error);
    return { error: "Couldn't delete the program. Please try again." };
  }
  if (data.length === 0) {
    return { error: "This program could not be found." };
  }

  redirect("/my?deleted=1");
}
