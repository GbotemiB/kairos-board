// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isSameOrigin, requestedHost } from "@/lib/http/same-origin";

const PREVIEW = "deploy-preview-5--kairos-board.netlify.app";

/** Like Netlify: the function sees an internal URL; the real host is in the headers. */
function behindProxy(headers: Record<string, string>) {
  return new NextRequest("http://internal-function-host:3000/api/extract", {
    method: "POST",
    headers,
  });
}

describe("requestedHost", () => {
  it("prefers the forwarded host", () => {
    expect(requestedHost(behindProxy({ "x-forwarded-host": PREVIEW, host: "internal" }))).toBe(
      PREVIEW,
    );
  });

  it("uses the first forwarded host when there are several", () => {
    expect(requestedHost(behindProxy({ "x-forwarded-host": `${PREVIEW}, proxy.internal` }))).toBe(
      PREVIEW,
    );
  });

  it("falls back to the Host header, then the URL", () => {
    expect(requestedHost(behindProxy({ host: "kairos-board.netlify.app" }))).toBe(
      "kairos-board.netlify.app",
    );
    expect(requestedHost(new NextRequest("http://localhost:3000/api/extract"))).toBe(
      "localhost:3000",
    );
  });
});

describe("isSameOrigin", () => {
  it("accepts a same-site request behind the proxy (the production bug)", () => {
    expect(
      isSameOrigin(behindProxy({ origin: `https://${PREVIEW}`, "x-forwarded-host": PREVIEW })),
    ).toBe(true);
  });

  it("rejects a cross-site origin behind the proxy", () => {
    expect(
      isSameOrigin(behindProxy({ origin: "https://evil.com", "x-forwarded-host": PREVIEW })),
    ).toBe(false);
  });

  it("rejects a look-alike subdomain", () => {
    expect(
      isSameOrigin(
        behindProxy({ origin: `https://${PREVIEW}.evil.com`, "x-forwarded-host": PREVIEW }),
      ),
    ).toBe(false);
  });

  it("compares hosts case-insensitively", () => {
    expect(
      isSameOrigin(
        behindProxy({
          origin: "https://Kairos-Board.Netlify.App",
          host: "kairos-board.netlify.app",
        }),
      ),
    ).toBe(true);
  });

  it("works locally without proxy headers", () => {
    const request = new NextRequest("http://localhost:3000/api/extract", {
      headers: { origin: "http://localhost:3000" },
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("allows requests without an Origin header", () => {
    expect(isSameOrigin(behindProxy({ "x-forwarded-host": PREVIEW }))).toBe(true);
  });

  it.each(["null", "not a url"])("rejects the malformed origin %j", (origin) => {
    expect(isSameOrigin(behindProxy({ origin, "x-forwarded-host": PREVIEW }))).toBe(false);
  });
});
