import { describe, expect, it } from "vitest";

import { MIN_PASSWORD_LENGTH, authErrorMessage, credentialsSchema } from "@/lib/auth/schema";

describe("credentialsSchema", () => {
  it("trims and lowercases the email", () => {
    expect(
      credentialsSchema.parse({ email: "  Me@Example.ORG ", password: "password123" }),
    ).toEqual({
      email: "me@example.org",
      password: "password123",
    });
  });

  it.each(["not-an-email", "", "a@", "@b.com"])("rejects the email %j", (email) => {
    const result = credentialsSchema.safeParse({ email, password: "password123" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Enter a valid email address.");
  });

  it("rejects a missing email with the same message", () => {
    expect(
      credentialsSchema.safeParse({ email: null, password: "password123" }).error?.issues[0]
        .message,
    ).toBe("Enter a valid email address.");
  });

  it(`requires at least ${MIN_PASSWORD_LENGTH} password characters`, () => {
    expect(
      credentialsSchema.safeParse({ email: "me@example.org", password: "short" }).success,
    ).toBe(false);
    expect(
      credentialsSchema.safeParse({
        email: "me@example.org",
        password: "x".repeat(MIN_PASSWORD_LENGTH),
      }).success,
    ).toBe(true);
  });

  it("rejects passwords over 72 characters (bcrypt limit)", () => {
    expect(
      credentialsSchema.safeParse({ email: "me@example.org", password: "x".repeat(73) }).success,
    ).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it.each([
    ["invalid_credentials", "Incorrect email or password."],
    ["user_already_exists", "An account with this email already exists. Try signing in."],
    ["email_exists", "An account with this email already exists. Try signing in."],
    ["email_not_confirmed", "Please confirm your email address first. Check your inbox."],
    ["weak_password", "That password is too weak. Try a longer one."],
    ["over_request_rate_limit", "Too many attempts. Please wait a minute and try again."],
  ])("maps %s", (code, message) => {
    expect(authErrorMessage(code)).toBe(message);
  });

  it.each(["unexpected_failure", undefined])("falls back to a generic message for %j", (code) => {
    expect(authErrorMessage(code)).toBe("Something went wrong. Please try again.");
  });
});
