"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeRedirectPath } from "@/lib/auth/redirect";
import { authErrorMessage, credentialsSchema, type AuthFormState } from "@/lib/auth/schema";
import { createServerSupabase } from "@/lib/supabase/server";

function parseCredentials(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (parsed.success) {
    return { ok: true as const, data: parsed.data };
  }
  const { fieldErrors } = z.flattenError(parsed.error);
  return {
    ok: false as const,
    state: {
      fieldErrors: { email: fieldErrors.email?.[0], password: fieldErrors.password?.[0] },
      email: typeof formData.get("email") === "string" ? String(formData.get("email")) : "",
    } satisfies AuthFormState,
  };
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const credentials = parseCredentials(formData);
  if (!credentials.ok) {
    return credentials.state;
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);
  if (error !== null) {
    return { error: authErrorMessage(error.code), email: credentials.data.email };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const credentials = parseCredentials(formData);
  if (!credentials.ok) {
    return credentials.state;
  }

  const origin = (await headers()).get("origin");
  const next = safeRedirectPath(formData.get("next"));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    ...credentials.data,
    options:
      origin === null
        ? undefined
        : { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error !== null) {
    return { error: authErrorMessage(error.code), email: credentials.data.email };
  }

  // With email confirmation on (production), there is no session yet.
  if (data.session === null) {
    return {
      message: "Check your email for a confirmation link to finish signing up.",
      email: credentials.data.email,
    };
  }

  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
