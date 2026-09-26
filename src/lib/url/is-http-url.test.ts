import { describe, expect, it } from "vitest";

import { isHttpUrl } from "@/lib/url/is-http-url";

describe("isHttpUrl", () => {
  it.each(["https://example.org/apply", "http://example.org", "HTTPS://EXAMPLE.ORG/path?q=1"])(
    "accepts %s",
    (value) => {
      expect(isHttpUrl(value)).toBe(true);
    },
  );

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.org/file",
    "mailto:someone@example.org",
    "/relative/path",
    "example.org",
    "",
  ])("rejects %j", (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });
});
