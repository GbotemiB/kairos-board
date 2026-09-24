import { describe, expect, it } from "vitest";

import { requireEnv } from "@/lib/env";

describe("requireEnv", () => {
  it("returns the value when set", () => {
    expect(requireEnv("FOO", "bar")).toBe("bar");
  });

  it.each([
    ["undefined", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
  ])("throws when the value is %s", (_label, value) => {
    expect(() => requireEnv("FOO", value)).toThrow("Missing environment variable FOO");
  });

  it("points to .env.example in the error", () => {
    expect(() => requireEnv("FOO", undefined)).toThrow(".env.example");
  });
});
