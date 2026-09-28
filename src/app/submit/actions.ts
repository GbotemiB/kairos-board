"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import {
  parseProgramForm,
  readFormValues,
  type ProgramFieldErrors,
  type ProgramFormValues,
} from "@/lib/programs/form";
import { createServerSupabase } from "@/lib/supabase/server";

export type SaveProgramState = {
  error?: string;
  fieldErrors?: ProgramFieldErrors;
  /** Echoed back so the form keeps the user's input (React resets forms after actions). */
  values?: ProgramFormValues;
  /** Changes on every failed submission so the form re-mounts with `values`. */
  attempt?: number;
};

const UNIQUE_VIOLATION = "23505";

export async function createProgram(
  previous: SaveProgramState,
  formData: FormData,
): Promise<SaveProgramState> {
  const values = readFormValues(formData);
  const attempt = (previous.attempt ?? 0) + 1;

  const user = await getCurrentUser();
  if (user === null) {
    return { error: "Your session has expired. Please sign in again.", values, attempt };
  }

  const parsed = parseProgramForm(values);
  if (!parsed.ok) {
    return { fieldErrors: parsed.fieldErrors, values, attempt };
  }

  const supabase = await createServerSupabase();
  // submitter_id defaults to auth.uid(); RLS and column grants enforce ownership.
  const { error } = await supabase.from("programs").insert(parsed.program);
  if (error !== null) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        error: "This program is already on the board (or was hidden by a moderator).",
        values,
        attempt,
      };
    }
    console.error("Failed to save program", error);
    return { error: "Couldn't save the program. Please try again.", values, attempt };
  }

  redirect("/?added=1");
}
