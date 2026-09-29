// @vitest-environment node
import { describe, expect, it } from "vitest";

import nextConfig, { SECURITY_HEADERS } from "./next.config";

describe("next.config", () => {
  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("applies the security headers to every path", async () => {
    const rules = await nextConfig.headers?.();

    expect(rules).toEqual([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  });

  it("forbids framing and MIME sniffing and limits referrers and browser features", () => {
    const headers = Object.fromEntries(SECURITY_HEADERS.map(({ key, value }) => [key, value]));

    expect(headers).toEqual({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    });
  });
});
