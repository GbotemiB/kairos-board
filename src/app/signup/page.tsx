import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signUp } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const next = safeRedirectPath((await searchParams).next);
  if ((await getCurrentUser()) !== null) {
    redirect(next);
  }

  return <AuthForm mode="signup" action={signUp} next={next} />;
}
