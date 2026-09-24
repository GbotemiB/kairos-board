/**
 * Returns the value or throws a clear error naming the missing variable.
 * NEXT_PUBLIC_* values must be passed in as literal `process.env.X` reads so
 * Next.js can inline them into client bundles.
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}
