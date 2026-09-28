import { afterEach, describe, expect, it, vi } from "vitest";

import { requestExtraction } from "@/lib/extract/client";

describe("requestExtraction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts JSON to /api/extract and returns the parsed body", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: false, code: "DUPLICATE", message: "dup" }, { status: 409 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await requestExtraction({ url: "https://example.org", text: "page" })).toEqual({
      ok: false,
      code: "DUPLICATE",
      message: "dup",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.org", text: "page" }),
    });
  });

  it("turns a network failure into an UNAVAILABLE response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );

    expect(await requestExtraction({ url: "https://example.org" })).toMatchObject({
      ok: false,
      code: "UNAVAILABLE",
    });
  });

  it("turns a non-JSON response into an UNAVAILABLE response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502</html>", { status: 502 })),
    );

    expect(await requestExtraction({ url: "https://example.org" })).toMatchObject({
      ok: false,
      code: "UNAVAILABLE",
    });
  });
});
