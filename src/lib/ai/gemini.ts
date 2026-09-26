import { GoogleGenAI, ThinkingLevel, type ThinkingConfig } from "@google/genai";

import { requireEnv } from "@/lib/env";
import {
  aiExtractionSchema,
  sanitizeExtraction,
  toGeminiSchema,
  type ExtractedProgram,
} from "@/lib/ai/schema";
import { SYSTEM_INSTRUCTION, buildExtractionPrompt, type PromptInput } from "@/lib/ai/prompt";

/** Chosen by benchmark (2026-09-26): fastest accurate model, plus a fallback. */
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_FALLBACK_MODEL = "gemini-2.5-flash";
/** Per-attempt timeout. */
export const ATTEMPT_TIMEOUT_MS = 4_000;
/** Do not start an attempt with less time than this left. */
export const MIN_ATTEMPT_MS = 1_500;

export type GenerateRequest = {
  model: string;
  systemInstruction: string;
  prompt: string;
  schema: Record<string, unknown>;
  signal: AbortSignal;
};

/** Returns the raw JSON text from the model. Injected so tests never call the API. */
export type GenerateJson = (request: GenerateRequest) => Promise<string>;

/** Gemini 2.x disables thinking with a zero budget; newer models use a level. */
export function thinkingConfigFor(model: string): ThinkingConfig {
  return /^gemini-2\./.test(model)
    ? { thinkingBudget: 0 }
    : { thinkingLevel: ThinkingLevel.MINIMAL };
}

export function createGeminiGenerate(apiKey: string): GenerateJson {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, systemInstruction, prompt, schema, signal }) => {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        thinkingConfig: thinkingConfigFor(model),
        abortSignal: signal,
      },
    });
    return response.text ?? "";
  };
}

export function getGeminiModels(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;
  return primary === fallback ? [primary] : [primary, fallback];
}

export function createDefaultGenerate(): GenerateJson {
  return createGeminiGenerate(requireEnv("GEMINI_API_KEY", process.env.GEMINI_API_KEY));
}

export type AttemptLog = { model: string; ms: number; error: string | null };

export type GeminiExtractionResult =
  | { ok: true; data: ExtractedProgram; model: string; attempts: AttemptLog[] }
  | { ok: false; attempts: AttemptLog[] };

type ExtractOptions = {
  generate: GenerateJson;
  models: string[];
  /** Total time available for all attempts. */
  budgetMs: number;
  attemptTimeoutMs?: number;
  now?: () => number;
};

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "AbortError" || error.name === "TimeoutError"
      ? "timed out"
      : error.message.slice(0, 200);
  }
  return String(error).slice(0, 200);
}

/**
 * Tries each model in order until one returns valid JSON matching the schema,
 * within the time budget. Never throws.
 */
export async function extractWithGemini(
  input: PromptInput,
  {
    generate,
    models,
    budgetMs,
    attemptTimeoutMs = ATTEMPT_TIMEOUT_MS,
    now = Date.now,
  }: ExtractOptions,
): Promise<GeminiExtractionResult> {
  const deadline = now() + budgetMs;
  const prompt = buildExtractionPrompt(input);
  const schema = toGeminiSchema();
  const attempts: AttemptLog[] = [];

  for (const model of models) {
    const remaining = deadline - now();
    if (remaining < MIN_ATTEMPT_MS) {
      break;
    }
    const started = now();
    try {
      const text = await generate({
        model,
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt,
        schema,
        signal: AbortSignal.timeout(Math.min(attemptTimeoutMs, remaining)),
      });
      const parsed = aiExtractionSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        attempts.push({ model, ms: now() - started, error: "response did not match schema" });
        continue;
      }
      attempts.push({ model, ms: now() - started, error: null });
      return { ok: true, data: sanitizeExtraction(parsed.data), model, attempts };
    } catch (error) {
      attempts.push({ model, ms: now() - started, error: describeError(error) });
    }
  }

  return { ok: false, attempts };
}
