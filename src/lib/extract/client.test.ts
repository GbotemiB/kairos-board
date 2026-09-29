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

  it.each([502, 504])("explains a hosting timeout page (HTTP %i)", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>Task timed out</html>", {
            status,
            headers: { "content-type": "text/html" },
          }),
      ),
    );

    expect(await requestExtraction({ url: "https://example.org" })).toEqual({
      ok: false,
      code: "UNAVAILABLE",
      message: "This took too long. Try again, or paste the page text instead.",
    });
  });

  it("explains other non-JSON error pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>500</html>", { status: 500 })),
    );

    expect(await requestExtraction({ url: "https://example.org" })).toEqual({
      ok: false,
      code: "UNAVAILABLE",
      message: "Something went wrong on our side. Please try again shortly.",
    });
  });
});
