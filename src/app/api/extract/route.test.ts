// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtractResult } from "@/lib/extract/extract-program";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  extractProgram: vi.fn(),
  checkRateLimit: vi.fn(),
  recordExtraction: vi.fn(),
  supabase: { tag: "server-supabase" },
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => mocks.supabase),
}));
vi.mock("@/lib/extract/extract-program", () => ({ extractProgram: mocks.extractProgram }));
vi.mock("@/lib/extract/extraction-log", () => ({
  checkRateLimit: mocks.checkRateLimit,
  recordExtraction: mocks.recordExtraction,
}));
const gemini = vi.hoisted(() => ({
  createDefaultGenerate: vi.fn(() => vi.fn(async () => "{}")),
}));
vi.mock("@/lib/ai/gemini", () => ({
  createDefaultGenerate: gemini.createDefaultGenerate,
  getGeminiModels: vi.fn(() => ["primary", "fallback"]),
}));

import { POST } from "@/app/api/extract/route";

const DATA = {
  title: "Fellowship",
  organization: null,
  type: "FELLOWSHIP",
  opensAt: null,
  deadline: null,
  deadlineType: "UNKNOWN",
  eligibility: [],
  location: null,
  field: null,
  funding: null,
  applicationsClosed: false,
  openToMasters: "UNCLEAR",
} as const;

function success(): ExtractResult {
  return {
    ok: true,
    url: "https://example.org/a",
    normalizedUrl: "https://example.org/a",
    data: { ...DATA, eligibility: [] },
    warnings: [],
    model: "primary",
    usedStructuredData: false,
    timings: { total: 100 },
    attempts: [],
  };
}

function failure(code: string, extra: Partial<ExtractResult> = {}): ExtractResult {
  return {
    ok: false,
    code,
    message: `message for ${code}`,
    normalizedUrl: code === "INVALID_URL" ? null : "https://example.org/a",
    existing: null,
    partial: null,
    timings: { total: 100 },
    attempts: [],
    ...extra,
  } as ExtractResult;
}

function post(
  body: unknown,
  {
    origin = "http://localhost:3000",
    contentType = "application/json",
  }: { origin?: string | null; contentType?: string } = {},
) {
  const headers: Record<string, string> = { "content-type": contentType };
  if (origin !== null) headers.origin = origin;
  return new NextRequest("http://localhost:3000/api/extract", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", email: "me@example.org" });
    mocks.checkRateLimit.mockResolvedValue({ ok: true, allowed: true, remaining: 9 });
    mocks.extractProgram.mockResolvedValue(success());
    mocks.recordExtraction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("request checks, before any work", () => {
    it("rejects a cross-site origin with 403", async () => {
      const response = await POST(
        post({ url: "https://example.org" }, { origin: "https://evil.com" }),
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "FORBIDDEN_ORIGIN" });
      expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    });

    it("allows requests without an Origin header (same-origin fetches may omit it)", async () => {
      expect((await POST(post({ url: "https://example.org" }, { origin: null }))).status).toBe(200);
    });

    it.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"])(
      "rejects the non-JSON content type %s with 415",
      async (contentType) => {
        const response = await POST(post('{"url":"https://example.org"}', { contentType }));

        expect(response.status).toBe(415);
        expect(mocks.extractProgram).not.toHaveBeenCalled();
      },
    );

    it("rejects signed-out users with 401", async () => {
      mocks.getCurrentUser.mockResolvedValue(null);

      const response = await POST(post({ url: "https://example.org" }));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        code: "UNAUTHENTICATED",
        message: "Sign in to add programs.",
      });
      expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    });

    it.each([
      ["malformed JSON", "{not json"],
      ["a missing url", {}],
      ["a non-string url", { url: 42 }],
      ["an oversized url", { url: "x".repeat(5000) }],
      ["oversized pasted text", { url: "https://example.org", text: "x".repeat(100_001) }],
    ])("rejects %s with 400", async (_name, body) => {
      const response = await POST(post(body));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "INVALID_REQUEST" });
      expect(mocks.extractProgram).not.toHaveBeenCalled();
    });
  });

  describe("rate limiting", () => {
    it("checks the limit for the signed-in user", async () => {
      await POST(post({ url: "https://example.org" }));

      expect(mocks.checkRateLimit).toHaveBeenCalledWith(mocks.supabase, "user-1");
    });

    it("returns 429 with Retry-After and a friendly message when over the limit", async () => {
      mocks.checkRateLimit.mockResolvedValue({ ok: true, allowed: false, retryAfterSeconds: 610 });

      const response = await POST(post({ url: "https://example.org" }));

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("610");
      expect((await response.json()).message).toMatch(/Try again in 11 minutes/);
      expect(mocks.extractProgram).not.toHaveBeenCalled();
      expect(mocks.recordExtraction).not.toHaveBeenCalled();
    });

    it("uses the singular for one minute", async () => {
      mocks.checkRateLimit.mockResolvedValue({ ok: true, allowed: false, retryAfterSeconds: 30 });

      expect((await (await POST(post({ url: "https://example.org" }))).json()).message).toMatch(
        /1 minute,/,
      );
    });

    it("fails closed with 503 when the limit cannot be checked", async () => {
      mocks.checkRateLimit.mockResolvedValue({ ok: false });

      const response = await POST(post({ url: "https://example.org" }));

      expect(response.status).toBe(503);
      expect(mocks.extractProgram).not.toHaveBeenCalled();
    });
  });

  describe("robustness", () => {
    it("accepts a same-site request behind a proxy (Netlify forwarded host)", async () => {
      const request = new NextRequest("http://internal-host:3000/api/extract", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://kairos-board.netlify.app",
          "x-forwarded-host": "kairos-board.netlify.app",
        },
        body: JSON.stringify({ url: "https://example.org" }),
      });

      expect((await POST(request)).status).toBe(200);
    });

    it("answers with JSON, not an HTML error page, when something unexpected throws", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.extractProgram.mockRejectedValue(new Error("boom"));

      const response = await POST(post({ url: "https://example.org" }));

      expect(response.status).toBe(503);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    });

    it("creates the Gemini client only when the AI step runs", async () => {
      // A missing GEMINI_API_KEY must not break responses that never reach the AI.
      gemini.createDefaultGenerate.mockImplementation(() => {
        throw new Error("Missing environment variable GEMINI_API_KEY");
      });
      mocks.extractProgram.mockResolvedValue(failure("THIN_CONTENT"));

      const response = await POST(post({ url: "https://example.org/a" }));

      expect(response.status).toBe(422);
      expect(gemini.createDefaultGenerate).not.toHaveBeenCalled();
    });

    it("creates the Gemini client once, when the pipeline calls it", async () => {
      const generate = vi.fn(async () => "{}");
      gemini.createDefaultGenerate.mockImplementation(() => generate);
      mocks.extractProgram.mockImplementation(
        async (_input: unknown, deps: { generate: (request: unknown) => Promise<string> }) => {
          await deps.generate({ model: "a" });
          await deps.generate({ model: "b" });
          return success();
        },
      );

      await POST(post({ url: "https://example.org/a" }));

      expect(gemini.createDefaultGenerate).toHaveBeenCalledTimes(1);
      expect(generate).toHaveBeenCalledTimes(2);
    });
  });

  describe("extraction", () => {
    it("passes the URL and pasted text to the pipeline", async () => {
      await POST(post({ url: "https://example.org/a", text: "pasted page" }));

      expect(mocks.extractProgram).toHaveBeenCalledWith(
        { url: "https://example.org/a", text: "pasted page" },
        expect.objectContaining({ models: ["primary", "fallback"] }),
      );
    });

    it("returns 200 with the data and records a success", async () => {
      const response = await POST(post({ url: "https://example.org/a" }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        url: "https://example.org/a",
        normalizedUrl: "https://example.org/a",
        data: DATA,
        warnings: [],
      });
      expect(mocks.recordExtraction).toHaveBeenCalledWith(
        mocks.supabase,
        "https://example.org/a",
        "SUCCESS",
      );
    });

    it.each([
      ["BLOCKED_HOST", 400],
      ["DUPLICATE", 409],
      ["UNSUPPORTED_CONTENT", 415],
      ["THIN_CONTENT", 422],
      ["FETCH_FAILED", 502],
      ["AI_FAILED", 502],
      ["AI_BUSY", 503],
    ])("returns %s as HTTP %i and records it", async (code, status) => {
      mocks.extractProgram.mockResolvedValue(failure(code));

      const response = await POST(post({ url: "https://example.org/a" }));

      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ ok: false, code });
      expect(mocks.recordExtraction).toHaveBeenCalledWith(
        mocks.supabase,
        "https://example.org/a",
        code,
      );
    });

    it("does not count invalid links toward the limit", async () => {
      mocks.extractProgram.mockResolvedValue(failure("INVALID_URL"));

      const response = await POST(post({ url: "nope" }));

      expect(response.status).toBe(400);
      expect(mocks.recordExtraction).not.toHaveBeenCalled();
    });

    it("sets Retry-After when the AI is busy", async () => {
      mocks.extractProgram.mockResolvedValue(
        failure("AI_BUSY", { partial: { ...DATA, eligibility: [] } }),
      );

      const response = await POST(post({ url: "https://example.org/a" }));

      expect(response.headers.get("retry-after")).toBe("60");
      expect(await response.json()).toMatchObject({ partial: { title: "Fellowship" } });
    });

    it("does not send timings or attempt details to the client", async () => {
      mocks.extractProgram.mockResolvedValue({
        ...success(),
        attempts: [{ model: "primary", ms: 1, error: "secret provider detail" }],
      });

      const text = await (await POST(post({ url: "https://example.org/a" }))).text();

      expect(text).not.toContain("secret provider detail");
      expect(text).not.toContain("timings");
    });
  });
});
