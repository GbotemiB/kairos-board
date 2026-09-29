import { redirect } from "next/navigation";
import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * The signed-in user, verified from the JWT (`getClaims`), or null. Cached per
 * request. This is the single place auth is checked; call it close to the data.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error !== null || data === null) {
    return null;
  }
  const { sub, email } = data.claims;
  if (typeof sub !== "string" || sub === "") {
    return null;
  }
  return { id: sub, email: typeof email === "string" ? email : null };
});

/** Redirects to the login page (and back afterwards) when signed out. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return user;
}
