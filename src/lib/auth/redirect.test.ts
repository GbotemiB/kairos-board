import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/auth/redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/", "/"],
    ["/submit", "/submit"],
    ["/programs/123?tab=edit#top", "/programs/123?tab=edit#top"],
    ["/a/../b", "/b"],
  ])("allows the same-site path %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    ["protocol-relative URL", "//evil.com"],
    ["protocol-relative with path", "//evil.com/submit"],
    ["absolute URL", "https://evil.com"],
    ["javascript URL", "javascript:alert(1)"],
    ["backslash trick", "/\\evil.com"],
    ["embedded backslash", "/foo\\..\\\\evil.com"],
    ["tab trick", "/\t/evil.com"],
    ["newline trick", "/\n/evil.com"],
    ["relative path", "submit"],
    ["empty", ""],
  ])("rejects a %s", (_name, input) => {
    expect(safeRedirectPath(input)).toBe("/");
  });

  it.each([null, undefined, 42, ["/submit"]])("rejects the non-string %j", (input) => {
    expect(safeRedirectPath(input)).toBe("/");
  });

  it("uses a custom fallback", () => {
    expect(safeRedirectPath("//evil.com", "/login")).toBe("/login");
  });
});
