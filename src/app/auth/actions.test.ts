import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  origin: "http://localhost:3000" as string | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({ auth: mocks.auth })),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers(mocks.origin === null ? {} : { origin: mocks.origin })),
}));
// Like Next.js, redirect() throws to stop the action.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import { signIn, signOut, signUp } from "@/app/auth/actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = { email: " Me@Example.org ", password: "password123" };

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns field errors without calling Supabase for invalid input", async () => {
    const state = await signIn({}, form({ email: "nope", password: "x" }));

    expect(state).toEqual({
      fieldErrors: {
        email: "Enter a valid email address.",
        password: "Use at least 8 characters.",
      },
      email: "nope",
    });
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in with normalized credentials and redirects to the next path", async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ error: null });

    await expect(signIn({}, form({ ...VALID, next: "/submit" }))).rejects.toThrow(
      "REDIRECT:/submit",
    );
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "me@example.org",
      password: "password123",
    });
  });

  it("ignores an unsafe next path", async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ error: null });

    await expect(signIn({}, form({ ...VALID, next: "//evil.com" }))).rejects.toThrow("REDIRECT:/");
  });

  it("returns a friendly error for wrong credentials and keeps the email", async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });

    expect(await signIn({}, form(VALID))).toEqual({
      error: "Incorrect email or password.",
      email: "me@example.org",
    });
  });
});

describe("signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.origin = "http://localhost:3000";
  });

  it("signs up with a confirmation link back to the app and redirects when a session exists", async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });

    await expect(signUp({}, form({ ...VALID, next: "/submit" }))).rejects.toThrow(
      "REDIRECT:/submit",
    );
    expect(mocks.auth.signUp).toHaveBeenCalledWith({
      email: "me@example.org",
      password: "password123",
      options: { emailRedirectTo: "http://localhost:3000/auth/confirm?next=%2Fsubmit" },
    });
  });

  it("asks the user to check their email when confirmation is required", async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });

    expect(await signUp({}, form(VALID))).toEqual({
      message: "Check your email for a confirmation link to finish signing up.",
      email: "me@example.org",
    });
  });

  it("omits the redirect option when the origin header is missing", async () => {
    mocks.origin = null;
    mocks.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await signUp({}, form(VALID));

    expect(mocks.auth.signUp).toHaveBeenCalledWith({
      email: "me@example.org",
      password: "password123",
      options: undefined,
    });
  });

  it("returns a friendly error when the account exists", async () => {
    mocks.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "user_already_exists" },
    });

    expect(await signUp({}, form(VALID))).toMatchObject({
      error: "An account with this email already exists. Try signing in.",
    });
  });

  it("validates before calling Supabase", async () => {
    await signUp({}, form({ email: "bad", password: "password123" }));

    expect(mocks.auth.signUp).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("signs out and redirects home", async () => {
    mocks.auth.signOut.mockResolvedValue({ error: null });

    await expect(signOut()).rejects.toThrow("REDIRECT:/");
    expect(mocks.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
