import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signIn } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);
  if ((await getCurrentUser()) !== null) {
    redirect(next);
  }

  const notice =
    params.error === "confirmation"
      ? "That confirmation link is invalid or has expired. Try signing in or sign up again."
      : undefined;

  return <AuthForm mode="signin" action={signIn} next={next} notice={notice} />;
}
