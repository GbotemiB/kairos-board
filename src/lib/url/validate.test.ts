import { describe, expect, it } from "vitest";

import { MAX_URL_LENGTH, validateUrl } from "@/lib/url/validate";

function expectValid(input: string) {
  const result = validateUrl(input);
  if (!result.ok) {
    throw new Error(`Expected ${JSON.stringify(input)} to be valid: ${result.message}`);
  }
  return result.url;
}

function expectInvalid(input: string) {
  const result = validateUrl(input);
  if (result.ok) {
    throw new Error(`Expected ${JSON.stringify(input)} to be invalid, got ${result.url.href}`);
  }
  return result.message;
}

describe("validateUrl", () => {
  describe("accepts", () => {
    it.each([
      ["https://example.org/fellowship", "https://example.org/fellowship"],
      ["http://example.org", "http://example.org/"],
      [
        "https://careers.example.co.uk/jobs/123?ref=abc",
        "https://careers.example.co.uk/jobs/123?ref=abc",
      ],
      ["https://example.org:443/apply", "https://example.org/apply"],
      ["http://example.org:80/apply", "http://example.org/apply"],
      ["https://[2001:db8::1]/apply", "https://[2001:db8::1]/apply"],
    ])("%s", (input, href) => {
      expect(expectValid(input).href).toBe(href);
    });

    it("trims surrounding whitespace", () => {
      expect(expectValid("  https://example.org/apply \n").href).toBe("https://example.org/apply");
    });

    it("adds https:// when the scheme is missing", () => {
      expect(expectValid("example.org/apply").href).toBe("https://example.org/apply");
      expect(expectValid("www.example.org").href).toBe("https://www.example.org/");
    });

    it(`accepts a link of exactly ${MAX_URL_LENGTH} characters`, () => {
      const base = "https://example.org/";
      const input = base + "a".repeat(MAX_URL_LENGTH - base.length);
      expect(input).toHaveLength(MAX_URL_LENGTH);
      expect(expectValid(input).href).toBe(input);
    });
  });

  describe("rejects", () => {
    it.each(["", "   ", "\n"])("an empty value %j", (input) => {
      expect(expectInvalid(input)).toBe("Enter a link.");
    });

    it(`a link longer than ${MAX_URL_LENGTH} characters`, () => {
      const input = "https://example.org/" + "a".repeat(MAX_URL_LENGTH);
      expect(expectInvalid(input)).toMatch(/at most 2048 characters/);
    });

    it.each([
      "javascript:alert(1)",
      "data:text/html,hi",
      "ftp://example.org/file",
      "file:///etc/passwd",
      "mailto:someone@example.org",
    ])("the non-http scheme %s", (input) => {
      expect(expectInvalid(input)).toBe("Only http:// and https:// links are supported.");
    });

    it.each(["https://user:pass@example.org", "https://user@example.org"])(
      "embedded credentials in %s",
      (input) => {
        expect(expectInvalid(input)).toMatch(/username or password/);
      },
    );

    it.each(["https://example.org:8080/apply", "http://example.org:22"])(
      "the custom port in %s",
      (input) => {
        expect(expectInvalid(input)).toMatch(/custom port/);
      },
    );

    it.each(["http://localhost/apply", "https://intranet", "localhost"])(
      "the single-label host in %s",
      (input) => {
        expect(expectInvalid(input)).toMatch(/full public link/);
      },
    );

    it("treats host:port without a scheme as an unsupported scheme", () => {
      expect(expectInvalid("localhost:3000")).toBe(
        "Only http:// and https:// links are supported.",
      );
    });

    it.each(["https://", "http://exa mple.org", "https://example..org:99999"])(
      "the unparseable value %j",
      (input) => {
        expect(validateUrl(input).ok).toBe(false);
      },
    );
  });
});
