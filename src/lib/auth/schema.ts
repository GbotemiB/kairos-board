import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 8;

export const credentialsSchema = z.object({
  // Trim before validating: z.email().trim() would reject pasted " me@x.com ".
  email: z
    .string({ error: "Enter a valid email address." })
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string({ error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` })
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(72, "Use at most 72 characters."),
});

export type AuthFormState = {
  /** Form-level error, e.g. wrong password. */
  error?: string;
  /** Per-field validation errors. */
  fieldErrors?: { email?: string; password?: string };
  /** Non-error notice, e.g. "check your email". */
  message?: string;
  /** Echoed back so the email field keeps its value after an error. */
  email?: string;
};

/** Friendly messages for Supabase Auth error codes. */
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Please confirm your email address first. Check your inbox.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try signing in.";
    case "weak_password":
      return "That password is too weak. Try a longer one.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
