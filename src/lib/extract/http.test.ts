// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ExtractedProgram } from "@/lib/ai/schema";
import type { ExtractResult } from "@/lib/extract/extract-program";
import { STATUS_BY_CODE, errorResponse, toApiResponse } from "@/lib/extract/http";

const DATA: ExtractedProgram = {
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
};

const TIMINGS = { total: 1234, ai: 1000 };
const ATTEMPTS = [{ model: "gemini", ms: 1000, error: '{"error":"provider internals"}' }];

describe("toApiResponse", () => {
  it("returns the extracted data and warnings, without timings or attempt details", () => {
    const result: ExtractResult = {
      ok: true,
      url: "https://example.org/a",
      normalizedUrl: "https://example.org/a",
      data: DATA,
      warnings: ["No deadline found. Check the official page."],
      model: "gemini",
      usedStructuredData: false,
      timings: TIMINGS,
      attempts: ATTEMPTS,
    };

    expect(toApiResponse(result)).toEqual({
      ok: true,
      url: "https://example.org/a",
      normalizedUrl: "https://example.org/a",
      data: DATA,
      warnings: ["No deadline found. Check the official page."],
    });
  });

  it("includes the existing program for duplicates", () => {
    const result: ExtractResult = {
      ok: false,
      code: "DUPLICATE",
      message: "This program is already on the board.",
      normalizedUrl: "https://example.org/a",
      existing: { id: "p1", title: "Existing" },
      partial: null,
      timings: TIMINGS,
      attempts: [],
    };

    expect(toApiResponse(result)).toEqual({
      ok: false,
      code: "DUPLICATE",
      message: "This program is already on the board.",
      existing: { id: "p1", title: "Existing" },
    });
  });

  it("includes partial data when the AI failed, but no provider error text", () => {
    const response = toApiResponse({
      ok: false,
      code: "AI_BUSY",
      message: "The AI is busy right now.",
      normalizedUrl: "https://example.org/a",
      existing: null,
      partial: DATA,
      timings: TIMINGS,
      attempts: ATTEMPTS,
    });

    expect(response).toEqual({
      ok: false,
      code: "AI_BUSY",
      message: "The AI is busy right now.",
      partial: DATA,
    });
    expect(JSON.stringify(response)).not.toContain("provider internals");
  });
});

describe("STATUS_BY_CODE", () => {
  it.each([
    ["INVALID_URL", 400],
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN_ORIGIN", 403],
    ["DUPLICATE", 409],
    ["UNSUPPORTED_CONTENT", 415],
    ["THIN_CONTENT", 422],
    ["RATE_LIMITED", 429],
    ["FETCH_FAILED", 502],
    ["AI_FAILED", 502],
    ["AI_BUSY", 503],
  ] as const)("maps %s to %i", (code, status) => {
    expect(STATUS_BY_CODE[code]).toBe(status);
  });
});

describe("errorResponse", () => {
  it("returns the code and message with the matching status", async () => {
    const response = errorResponse("UNAUTHENTICATED", "Sign in to add programs.");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Sign in to add programs.",
    });
    expect(response.headers.get("retry-after")).toBeNull();
  });

  it("sets Retry-After when given", () => {
    expect(
      errorResponse("RATE_LIMITED", "Slow down", { retryAfterSeconds: 90 }).headers.get(
        "retry-after",
      ),
    ).toBe("90");
  });
});
