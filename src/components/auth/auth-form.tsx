"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH, type AuthFormState } from "@/lib/auth/schema";

type AuthFormProps = {
  mode: "signin" | "signup";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next: string;
  /** Shown above the form, e.g. after a failed email confirmation. */
  notice?: string;
};

export function AuthForm({ mode, action, next, notice }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const isSignUp = mode === "signup";
  const otherHref = `${isSignUp ? "/login" : "/signup"}${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isSignUp ? "Create an account" : "Sign in"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isSignUp
            ? "Sign up to share opportunities with other students."
            : "Sign in to add programs to the board."}
        </p>
      </div>

      {notice !== undefined && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {notice}
        </p>
      )}
      {state.error !== undefined && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {state.error}
        </p>
      )}
      {state.message !== undefined && (
        <p role="status" className="bg-muted rounded-md p-3 text-sm">
          {state.message}
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            aria-invalid={state.fieldErrors?.email !== undefined}
            aria-describedby={state.fieldErrors?.email !== undefined ? "email-error" : undefined}
          />
          {state.fieldErrors?.email !== undefined && (
            <p id="email-error" className="text-destructive text-sm">
              {state.fieldErrors.email}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
            aria-invalid={state.fieldErrors?.password !== undefined}
            aria-describedby={
              state.fieldErrors?.password !== undefined ? "password-error" : undefined
            }
          />
          {state.fieldErrors?.password !== undefined && (
            <p id="password-error" className="text-destructive text-sm">
              {state.fieldErrors.password}
            </p>
          )}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-muted-foreground text-sm">
        {isSignUp ? "Already have an account? " : "New to Kairos? "}
        <Link href={otherHref} className="text-foreground underline underline-offset-4">
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
