import { describe, expect, it, vi } from "vitest";

import type { GenerateJson } from "@/lib/ai/gemini";
import type { ExtractedProgram } from "@/lib/ai/schema";
import {
  MIN_PASTED_CHARS,
  buildWarnings,
  extractProgram,
  isAiBusy,
  type ExtractDeps,
} from "@/lib/extract/extract-program";
import type { DuplicateCheckResult } from "@/lib/programs/duplicates";
import type { SafeFetchResult } from "@/lib/scrape/safe-fetch";

const NOW = Date.parse("2026-09-26T12:00:00Z");

const AI_JSON = {
  title: "Graduate Climate Fellowship",
  organization: "Example Climate Institute",
  type: "FELLOWSHIP",
  opensAt: null,
  deadline: "2026-11-15",
  deadlineType: "FIXED",
  eligibility: ["Master's students"],
  location: "Lisbon, Portugal",
  field: "Climate policy",
  funding: "Stipend",
  applicationsClosed: false,
  openToMasters: "YES",
};

const LONG_TEXT = "The Example Climate Institute invites applications. ".repeat(20);
const PAGE_HTML = `<html><head><title>Fellowship</title></head><body><main><p>${LONG_TEXT}</p></main></body></html>`;

function fetched(html = PAGE_HTML): SafeFetchResult {
  return { ok: true, finalUrl: new URL("https://example.org/fellowship"), html, truncated: false };
}

function deps(overrides: Partial<ExtractDeps> = {}) {
  const findDuplicate = vi
    .fn<(normalized: string) => Promise<DuplicateCheckResult>>()
    .mockResolvedValue({ ok: true, existing: null });
  const fetchPage = vi.fn<(url: URL) => Promise<SafeFetchResult>>().mockResolvedValue(fetched());
  const generate = vi.fn<GenerateJson>().mockResolvedValue(JSON.stringify(AI_JSON));
  const base = {
    findDuplicate,
    fetchPage,
    generate,
    models: ["primary", "fallback"],
    now: () => NOW,
  } satisfies ExtractDeps;
  // Overrides in these tests are always vi.fn() mocks, so keep the mock types.
  return { ...base, ...overrides } as typeof base;
}

describe("extractProgram", () => {
  it("runs the full pipeline and returns the merged data", async () => {
    const d = deps();

    const result = await extractProgram(
      { url: "https://www.example.org/fellowship?utm_source=x" },
      d,
    );

    expect(result).toMatchObject({
      ok: true,
      url: "https://www.example.org/fellowship?utm_source=x",
      normalizedUrl: "https://example.org/fellowship",
      model: "primary",
      usedStructuredData: false,
      warnings: [],
      data: { title: "Graduate Climate Fellowship", deadline: "2026-11-15" },
    });
    expect(d.findDuplicate).toHaveBeenCalledWith("https://example.org/fellowship");
    expect(d.fetchPage).toHaveBeenCalledWith(
      new URL("https://www.example.org/fellowship?utm_source=x"),
    );
  });

  it("sends today's date and the page text to the AI", async () => {
    const d = deps();

    await extractProgram({ url: "https://example.org/fellowship" }, d);

    const prompt = d.generate.mock.calls[0][0].prompt;
    expect(prompt).toContain("Today's date: 2026-09-26");
    expect(prompt).toContain("The Example Climate Institute invites applications.");
  });

  it("reports timings for every stage", async () => {
    const result = await extractProgram({ url: "https://example.org/fellowship" }, deps());

    expect(Object.keys(result.timings).sort()).toEqual(
      ["ai", "duplicate", "fetch", "read", "total", "validate"].sort(),
    );
  });

  it("returns INVALID_URL without touching the network", async () => {
    const d = deps();

    const result = await extractProgram({ url: "javascript:alert(1)" }, d);

    expect(result).toMatchObject({ ok: false, code: "INVALID_URL" });
    expect(d.findDuplicate).not.toHaveBeenCalled();
    expect(d.fetchPage).not.toHaveBeenCalled();
  });

  it("returns DUPLICATE with the existing program and skips fetching", async () => {
    const d = deps({
      findDuplicate: vi
        .fn()
        .mockResolvedValue({ ok: true, existing: { id: "p1", title: "Existing" } }),
    });

    const result = await extractProgram({ url: "https://example.org/fellowship" }, d);

    expect(result).toMatchObject({
      ok: false,
      code: "DUPLICATE",
      existing: { id: "p1", title: "Existing" },
      normalizedUrl: "https://example.org/fellowship",
    });
    expect(d.fetchPage).not.toHaveBeenCalled();
  });

  it("continues when the duplicate lookup itself fails", async () => {
    const d = deps({ findDuplicate: vi.fn().mockResolvedValue({ ok: false }) });

    expect((await extractProgram({ url: "https://example.org/fellowship" }, d)).ok).toBe(true);
  });

  it.each([
    ["BLOCKED_HOST", "This link can't be fetched."],
    ["FETCH_FAILED", "We couldn't load that page. You can paste its text instead."],
    [
      "UNSUPPORTED_CONTENT",
      "That link isn't a web page (it may be a PDF). You can paste its text instead.",
    ],
  ] as const)("maps a %s fetch error to a user-facing message", async (code, message) => {
    const d = deps({
      fetchPage: vi.fn().mockResolvedValue({ ok: false, code, message: "internal detail" }),
    });

    const result = await extractProgram({ url: "https://example.org/fellowship" }, d);

    expect(result).toMatchObject({ ok: false, code, message });
    expect(d.generate).not.toHaveBeenCalled();
  });

  it("returns THIN_CONTENT for a JavaScript-rendered page", async () => {
    const d = deps({
      fetchPage: vi
        .fn()
        .mockResolvedValue(fetched('<html><body><div id="root"></div></body></html>')),
    });

    const result = await extractProgram({ url: "https://example.org/app" }, d);

    expect(result).toMatchObject({
      ok: false,
      code: "THIN_CONTENT",
      message: expect.stringMatching(/paste its text/),
    });
    expect(d.generate).not.toHaveBeenCalled();
  });

  it("uses structured data even when the page text is thin", async () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Data Intern",
      hiringOrganization: "Example Analytics",
      validThrough: "2026-12-01",
    })}</script></head><body><div id="app"></div></body></html>`;
    const d = deps({ fetchPage: vi.fn().mockResolvedValue(fetched(html)) });

    const result = await extractProgram({ url: "https://example.org/job" }, d);

    expect(result).toMatchObject({
      ok: true,
      usedStructuredData: true,
      data: { title: "Data Intern", organization: "Example Analytics", deadline: "2026-12-01" },
    });
  });

  describe("paste-text mode", () => {
    it("skips the fetch and extracts from the pasted text", async () => {
      const d = deps();

      const result = await extractProgram(
        { url: "https://example.org/fellowship", text: LONG_TEXT },
        d,
      );

      expect(result.ok).toBe(true);
      expect(d.fetchPage).not.toHaveBeenCalled();
      expect(d.generate.mock.calls[0][0].prompt).toContain(
        "The Example Climate Institute invites applications.",
      );
    });

    it("still validates the URL and checks duplicates", async () => {
      const d = deps({
        findDuplicate: vi
          .fn()
          .mockResolvedValue({ ok: true, existing: { id: "p1", title: "Existing" } }),
      });

      expect(await extractProgram({ url: "ftp://example.org", text: LONG_TEXT }, d)).toMatchObject({
        code: "INVALID_URL",
      });
      expect(
        await extractProgram({ url: "https://example.org/x", text: LONG_TEXT }, d),
      ).toMatchObject({
        code: "DUPLICATE",
      });
    });

    it(`rejects pasted text shorter than ${MIN_PASTED_CHARS} characters`, async () => {
      const d = deps();

      const result = await extractProgram({ url: "https://example.org/x", text: "Too short" }, d);

      expect(result).toMatchObject({
        ok: false,
        code: "THIN_CONTENT",
        message: expect.stringMatching(/Paste more/),
      });
      expect(d.generate).not.toHaveBeenCalled();
    });
  });

  it("returns AI_FAILED with partial data from page metadata when every model fails", async () => {
    const d = deps({
      generate: vi.fn<GenerateJson>().mockRejectedValue(new Error("400 invalid argument")),
    });

    const result = await extractProgram({ url: "https://example.org/fellowship" }, d);

    expect(result).toMatchObject({
      ok: false,
      code: "AI_FAILED",
      partial: { title: "Fellowship" },
      attempts: [
        { model: "primary", error: "400 invalid argument" },
        { model: "fallback", error: "400 invalid argument" },
      ],
    });
  });

  it.each([
    ["quota exhausted", '{"error":{"code":429,"message":"You exceeded your current quota"}}'],
    [
      "overloaded",
      '{"error":{"code":503,"message":"This model is currently experiencing high demand"}}',
    ],
  ])("returns AI_BUSY with partial data when every model is %s", async (_name, message) => {
    const d = deps({ generate: vi.fn<GenerateJson>().mockRejectedValue(new Error(message)) });

    const result = await extractProgram({ url: "https://example.org/fellowship" }, d);

    expect(result).toMatchObject({
      ok: false,
      code: "AI_BUSY",
      message: expect.stringMatching(/busy/),
      partial: { title: "Fellowship" },
    });
  });

  it("returns AI_FAILED, not AI_BUSY, when only some attempts were busy", async () => {
    const d = deps({
      generate: vi
        .fn<GenerateJson>()
        .mockRejectedValueOnce(new Error("429 quota"))
        .mockResolvedValueOnce("not json"),
    });

    expect(await extractProgram({ url: "https://example.org/fellowship" }, d)).toMatchObject({
      code: "AI_FAILED",
    });
  });

  it("passes the remaining budget to the AI step", async () => {
    let clock = NOW;
    const d = deps({
      budgetMs: 9_000,
      now: () => clock,
      fetchPage: vi.fn().mockImplementation(async () => {
        clock += 8_000; // A slow page leaves too little time for the AI.
        return fetched();
      }),
    });

    const result = await extractProgram({ url: "https://example.org/fellowship" }, d);

    expect(d.generate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, code: "AI_FAILED", attempts: [] });
  });
});

describe("buildWarnings", () => {
  const base: ExtractedProgram = {
    title: "Fellowship",
    organization: null,
    type: "FELLOWSHIP",
    opensAt: null,
    deadline: "2026-11-15",
    deadlineType: "FIXED",
    eligibility: [],
    location: null,
    field: null,
    funding: null,
    applicationsClosed: false,
    openToMasters: "YES",
  };
  const now = new Date(NOW);
  const notTruncated = { textTruncated: false };

  it("has no warnings for complete data", () => {
    expect(buildWarnings(base, notTruncated, now)).toEqual([]);
  });

  it("warns about a missing title", () => {
    expect(buildWarnings({ ...base, title: null }, notTruncated, now)).toEqual([
      "Couldn't find the program name. Please add it.",
    ]);
  });

  it("warns about a missing deadline unless it is rolling", () => {
    expect(
      buildWarnings({ ...base, deadline: null, deadlineType: "UNKNOWN" }, notTruncated, now),
    ).toEqual(["No deadline found. Check the official page."]);
    expect(
      buildWarnings({ ...base, deadline: null, deadlineType: "ROLLING" }, notTruncated, now),
    ).toEqual([]);
  });

  it("warns about a past deadline but not one due today", () => {
    expect(buildWarnings({ ...base, deadline: "2026-09-25" }, notTruncated, now)).toEqual([
      "The deadline has already passed.",
    ]);
    expect(buildWarnings({ ...base, deadline: "2026-09-26" }, notTruncated, now)).toEqual([]);
  });

  it("warns when the program may not be open to master's students", () => {
    expect(buildWarnings({ ...base, openToMasters: "NO" }, notTruncated, now)).toEqual([
      "This may not be open to master's students.",
    ]);
  });

  it("does not warn when eligibility for master's students is unclear", () => {
    expect(buildWarnings({ ...base, openToMasters: "UNCLEAR" }, notTruncated, now)).toEqual([]);
  });

  it("warns when applications are closed", () => {
    expect(buildWarnings({ ...base, applicationsClosed: true }, notTruncated, now)).toEqual([
      "The page says applications are closed.",
    ]);
  });

  it("warns when only part of the page was read", () => {
    expect(buildWarnings(base, { textTruncated: true }, now)).toEqual([
      "The page is very long; only the first part was read.",
    ]);
  });
});

describe("isAiBusy", () => {
  const attempt = (error: string | null) => ({ model: "m", ms: 1, error });

  it.each([
    "429 Too Many Requests",
    '{"error":{"code":503}}',
    "RESOURCE_EXHAUSTED",
    "UNAVAILABLE",
    "high demand",
    "You exceeded your current quota",
  ])("treats %j as busy", (error) => {
    expect(isAiBusy([attempt(error)])).toBe(true);
  });

  it.each([["timed out"], ["response did not match schema"], ["400 invalid argument"]])(
    "does not treat %j as busy",
    (error) => {
      expect(isAiBusy([attempt(error)])).toBe(false);
    },
  );

  it("requires every attempt to be busy", () => {
    expect(isAiBusy([attempt("429"), attempt("timed out")])).toBe(false);
    expect(isAiBusy([attempt("429"), attempt("503")])).toBe(true);
  });

  it("is false when nothing was attempted", () => {
    expect(isAiBusy([])).toBe(false);
  });

  it("ignores successful attempts", () => {
    expect(isAiBusy([attempt(null)])).toBe(false);
  });
});
