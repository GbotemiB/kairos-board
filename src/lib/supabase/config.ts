import { requireEnv } from "@/lib/env";

/** Literal process.env reads so Next.js can inline NEXT_PUBLIC_* values. */
export function getSupabaseConfig(): { url: string; key: string } {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    key: requireEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}
