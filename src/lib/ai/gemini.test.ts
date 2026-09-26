import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: vi.fn(function GoogleGenAI() {
      return { models: { generateContent } };
    }),
  };
});

import { ThinkingLevel } from "@google/genai";

import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_MODEL,
  MIN_ATTEMPT_MS,
  createGeminiGenerate,
  extractWithGemini,
  getGeminiModels,
  thinkingConfigFor,
  type GenerateJson,
} from "@/lib/ai/gemini";
import { SYSTEM_INSTRUCTION, type PromptInput } from "@/lib/ai/prompt";
import { toGeminiSchema } from "@/lib/ai/schema";

const INPUT: PromptInput = {
  url: "https://example.org/fellowship",
  today: "2026-09-26",
  meta: { title: null, siteName: null, description: null },
  structured: null,
  text: "Applications close 15 November 2026.",
};

const VALID = {
  title: "Graduate Fellowship",
  organization: "Example Foundation",
  type: "FELLOWSHIP",
  opensAt: null,
  deadline: "2026-11-15",
  deadlineType: "FIXED",
  eligibility: ["Master's students"],
  location: null,
  field: null,
  funding: null,
  applicationsClosed: false,
  openToMasters: "YES",
};

describe("thinkingConfigFor", () => {
  it("uses a zero budget for Gemini 2.x", () => {
    expect(thinkingConfigFor("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
  });

  it("uses the minimal level for newer models", () => {
    expect(thinkingConfigFor("gemini-3.5-flash-lite")).toEqual({
      thinkingLevel: ThinkingLevel.MINIMAL,
    });
  });
});

describe("getGeminiModels", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the benchmarked primary and fallback", () => {
    vi.stubEnv("GEMINI_MODEL", "");
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "");

    expect(getGeminiModels()).toEqual([DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]);
  });

  it("reads overrides from the environment", () => {
    vi.stubEnv("GEMINI_MODEL", "model-a");
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "model-b");

    expect(getGeminiModels()).toEqual(["model-a", "model-b"]);
  });

  it("does not try the same model twice", () => {
    vi.stubEnv("GEMINI_MODEL", "model-a");
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "model-a");

    expect(getGeminiModels()).toEqual(["model-a"]);
  });
});

describe("createGeminiGenerate", () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it("requests schema-constrained JSON with deterministic, low-latency settings", async () => {
    generateContent.mockResolvedValue({ text: '{"ok":true}' });
    const generate = createGeminiGenerate("test-key");
    const signal = new AbortController().signal;
    const schema = toGeminiSchema();

    const text = await generate({
      model: "gemini-3.5-flash-lite",
      systemInstruction: "rules",
      prompt: "page",
      schema,
      signal,
    });

    expect(text).toBe('{"ok":true}');
    expect(generateContent).toHaveBeenCalledWith({
      model: "gemini-3.5-flash-lite",
      contents: "page",
      config: {
        systemInstruction: "rules",
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        abortSignal: signal,
      },
    });
  });

  it("returns an empty string when the response has no text", async () => {
    generateContent.mockResolvedValue({ text: undefined });

    const text = await createGeminiGenerate("k")({
      model: "m",
      systemInstruction: "",
      prompt: "",
      schema: {},
      signal: new AbortController().signal,
    });

    expect(text).toBe("");
  });
});

describe("extractWithGemini", () => {
  function options(generate: GenerateJson, overrides = {}) {
    return { generate, models: ["primary", "fallback"], budgetMs: 8_000, ...overrides };
  }

  it("returns sanitized data from the first model that succeeds", async () => {
    const generate = vi
      .fn<GenerateJson>()
      .mockResolvedValue(JSON.stringify({ ...VALID, title: "  Graduate Fellowship " }));

    const result = await extractWithGemini(INPUT, options(generate));

    expect(result).toMatchObject({
      ok: true,
      model: "primary",
      data: { title: "Graduate Fellowship" },
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("sends the system instruction, prompt and schema", async () => {
    const generate = vi.fn<GenerateJson>().mockResolvedValue(JSON.stringify(VALID));

    await extractWithGemini(INPUT, options(generate));

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "primary",
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt: expect.stringContaining("<page_text>"),
        schema: toGeminiSchema(),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    ["an API error", () => Promise.reject(new Error("503 high demand"))],
    ["invalid JSON", () => Promise.resolve("not json")],
    ["a schema mismatch", () => Promise.resolve(JSON.stringify({ title: "only a title" }))],
  ])("falls back to the next model after %s", async (_name, firstCall) => {
    const generate = vi
      .fn<GenerateJson>()
      .mockImplementationOnce(firstCall)
      .mockResolvedValueOnce(JSON.stringify(VALID));

    const result = await extractWithGemini(INPUT, options(generate));

    expect(result).toMatchObject({ ok: true, model: "fallback" });
    expect(result.attempts.map((attempt) => [attempt.model, attempt.error === null])).toEqual([
      ["primary", false],
      ["fallback", true],
    ]);
  });

  it("records why each attempt failed", async () => {
    const generate = vi
      .fn<GenerateJson>()
      .mockRejectedValueOnce(new Error("503 high demand"))
      .mockResolvedValueOnce(JSON.stringify({ title: "x" }));

    const result = await extractWithGemini(INPUT, options(generate));

    expect(result).toMatchObject({
      ok: false,
      attempts: [
        { model: "primary", error: "503 high demand" },
        { model: "fallback", error: "response did not match schema" },
      ],
    });
  });

  it("reports a timeout when the attempt is aborted", async () => {
    const generate: GenerateJson = ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
      });

    const result = await extractWithGemini(INPUT, {
      generate,
      models: ["primary"],
      budgetMs: 8_000,
      attemptTimeoutMs: 50,
    });

    expect(result).toMatchObject({
      ok: false,
      attempts: [{ model: "primary", error: "timed out" }],
    });
  });

  it("skips the fallback when too little of the budget is left", async () => {
    let clock = 0;
    const generate = vi.fn<GenerateJson>().mockImplementation(async () => {
      clock += 7_000; // The primary attempt used most of the budget.
      throw new Error("slow failure");
    });

    const result = await extractWithGemini(INPUT, options(generate, { now: () => clock }));

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, attempts: [{ model: "primary" }] });
  });

  it("does not start at all when the budget is below the minimum attempt time", async () => {
    const generate = vi.fn<GenerateJson>();

    const result = await extractWithGemini(
      INPUT,
      options(generate, { budgetMs: MIN_ATTEMPT_MS - 1 }),
    );

    expect(generate).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, attempts: [] });
  });

  it("caps each attempt's timeout at the remaining budget", async () => {
    const generate = vi.fn<GenerateJson>().mockResolvedValue(JSON.stringify(VALID));
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await extractWithGemini(
      INPUT,
      options(generate, { budgetMs: 2_000, attemptTimeoutMs: 4_000, now: () => 0 }),
    );

    expect(timeout).toHaveBeenCalledWith(2_000);
    timeout.mockRestore();
  });
});
