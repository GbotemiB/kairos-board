import { extractWithGemini, type AttemptLog, type GenerateJson } from "@/lib/ai/gemini";
import { mergeExtraction } from "@/lib/ai/merge";
import type { ExtractedProgram } from "@/lib/ai/schema";
import { daysUntil, parseDate } from "@/lib/programs/deadline";
import type { DuplicateCheckResult, ExistingProgram } from "@/lib/programs/duplicates";
import { MAX_TEXT_CHARS } from "@/lib/scrape/extract-text";
import { readPage, type PageContent } from "@/lib/scrape/read-page";
import { safeFetch, type SafeFetchResult } from "@/lib/scrape/safe-fetch";
import { normalizeUrl } from "@/lib/url/normalize";
import { validateUrl } from "@/lib/url/validate";

/** Total time for one extraction; leaves headroom under Netlify's 10s limit. */
export const TOTAL_BUDGET_MS = 9_000;
/** Pasted text shorter than this is not worth sending to the AI. */
export const MIN_PASTED_CHARS = 100;

export type ExtractErrorCode =
  | "INVALID_URL"
  | "BLOCKED_HOST"
  | "DUPLICATE"
  | "FETCH_FAILED"
  | "UNSUPPORTED_CONTENT"
  | "THIN_CONTENT"
  | "AI_FAILED"
  | "AI_BUSY";

export type Stage = "validate" | "duplicate" | "fetch" | "read" | "ai";
export type Timings = Partial<Record<Stage, number>> & { total: number };

export type ExtractSuccess = {
  ok: true;
  /** The URL as it will be stored (validated, original scheme and path). */
  url: string;
  normalizedUrl: string;
  data: ExtractedProgram;
  warnings: string[];
  model: string | null;
  usedStructuredData: boolean;
  timings: Timings;
  attempts: AttemptLog[];
};

export type ExtractFailure = {
  ok: false;
  code: ExtractErrorCode;
  message: string;
  normalizedUrl: string | null;
  /** Set for DUPLICATE. */
  existing: ExistingProgram | null;
  /** Set for AI_FAILED: whatever structured data and metadata provided. */
  partial: ExtractedProgram | null;
  timings: Timings;
  attempts: AttemptLog[];
};

export type ExtractResult = ExtractSuccess | ExtractFailure;

export type ExtractInput = {
  url: string;
  /** Paste-text mode: page text supplied by the user; the URL is not fetched. */
  text?: string;
};

export type ExtractDeps = {
  findDuplicate: (normalizedUrl: string) => Promise<DuplicateCheckResult>;
  generate: GenerateJson;
  models: string[];
  fetchPage?: (url: URL) => Promise<SafeFetchResult>;
  budgetMs?: number;
  /** Clock in milliseconds; injected for tests. */
  now?: () => number;
};

function pastedPage(text: string): PageContent {
  const cleaned = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
  return {
    meta: { title: null, siteName: null, description: null },
    structured: null,
    text: cleaned.slice(0, MAX_TEXT_CHARS),
    textTruncated: cleaned.length > MAX_TEXT_CHARS,
    isThin: cleaned.length < MIN_PASTED_CHARS,
  };
}

/** Quota exhausted (429) or model overloaded (503): worth retrying shortly. */
const BUSY_ERROR = /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|quota/i;

export function isAiBusy(attempts: AttemptLog[]): boolean {
  return (
    attempts.length > 0 &&
    attempts.every((attempt) => attempt.error !== null && BUSY_ERROR.test(attempt.error))
  );
}

export function buildWarnings(
  data: ExtractedProgram,
  page: Pick<PageContent, "textTruncated">,
  now: Date,
): string[] {
  const warnings: string[] = [];
  if (data.title === null) {
    warnings.push("Couldn't find the program name. Please add it.");
  }
  if (data.deadline === null && data.deadlineType !== "ROLLING") {
    warnings.push("No deadline found. Check the official page.");
  }
  const deadline = data.deadline === null ? null : parseDate(data.deadline);
  if (deadline !== null && daysUntil(deadline, now) < 0) {
    warnings.push("The deadline has already passed.");
  }
  if (data.openToMasters === "NO") {
    warnings.push("This may not be open to master's students.");
  }
  if (data.applicationsClosed) {
    warnings.push("The page says applications are closed.");
  }
  if (page.textTruncated) {
    warnings.push("The page is very long; only the first part was read.");
  }
  return warnings;
}

/**
 * The full "magic link" pipeline: validate, check duplicates, fetch, read,
 * extract with AI, merge with structured data. Never throws.
 */
export async function extractProgram(
  input: ExtractInput,
  deps: ExtractDeps,
): Promise<ExtractResult> {
  const {
    findDuplicate,
    generate,
    models,
    fetchPage = safeFetch,
    budgetMs = TOTAL_BUDGET_MS,
  } = deps;
  const now = deps.now ?? Date.now;
  const started = now();
  const timings: Partial<Record<Stage, number>> = {};
  let attempts: AttemptLog[] = [];

  async function timed<T>(stage: Stage, run: () => Promise<T> | T): Promise<T> {
    const stageStart = now();
    try {
      return await run();
    } finally {
      timings[stage] = now() - stageStart;
    }
  }

  function fail(
    code: ExtractErrorCode,
    message: string,
    extra: Partial<Pick<ExtractFailure, "normalizedUrl" | "existing" | "partial">> = {},
  ): ExtractFailure {
    return {
      ok: false,
      code,
      message,
      normalizedUrl: extra.normalizedUrl ?? null,
      existing: extra.existing ?? null,
      partial: extra.partial ?? null,
      timings: { ...timings, total: now() - started },
      attempts,
    };
  }

  const validated = await timed("validate", () => validateUrl(input.url));
  if (!validated.ok) {
    return fail("INVALID_URL", validated.message);
  }
  const url = validated.url;
  const normalizedUrl = normalizeUrl(url);

  const duplicate = await timed("duplicate", () => findDuplicate(normalizedUrl));
  // A failed lookup is not fatal: the unique constraint still guards inserts.
  if (duplicate.ok && duplicate.existing !== null) {
    return fail("DUPLICATE", "This program is already on the board.", {
      normalizedUrl,
      existing: duplicate.existing,
    });
  }

  let page: PageContent;
  if (input.text !== undefined) {
    page = await timed("read", () => pastedPage(input.text ?? ""));
    if (page.isThin) {
      return fail("THIN_CONTENT", "Paste more of the page text so there is enough to read.", {
        normalizedUrl,
      });
    }
  } else {
    const fetched = await timed("fetch", () => fetchPage(url));
    if (!fetched.ok) {
      const messages: Record<typeof fetched.code, string> = {
        BLOCKED_HOST: "This link can't be fetched.",
        FETCH_FAILED: "We couldn't load that page. You can paste its text instead.",
        UNSUPPORTED_CONTENT:
          "That link isn't a web page (it may be a PDF). You can paste its text instead.",
      };
      return fail(fetched.code, messages[fetched.code], { normalizedUrl });
    }
    page = await timed("read", () => readPage(fetched.html));
    if (page.isThin) {
      return fail(
        "THIN_CONTENT",
        "That page loads its content with JavaScript, so we couldn't read it. You can paste its text instead.",
        { normalizedUrl },
      );
    }
  }

  const today = new Date(now()).toISOString().slice(0, 10);
  const ai = await timed("ai", () =>
    extractWithGemini(
      { url: url.href, today, meta: page.meta, structured: page.structured, text: page.text },
      { generate, models, budgetMs: budgetMs - (now() - started), now },
    ),
  );
  attempts = ai.attempts;

  const data = mergeExtraction(ai.ok ? ai.data : null, page.structured, page.meta);
  if (!ai.ok) {
    if (isAiBusy(ai.attempts)) {
      return fail(
        "AI_BUSY",
        "The AI is busy right now. Try again in a minute, or fill in the details yourself.",
        { normalizedUrl, partial: data },
      );
    }
    return fail("AI_FAILED", "Automatic extraction failed. Please fill in the details.", {
      normalizedUrl,
      partial: data,
    });
  }

  return {
    ok: true,
    url: url.href,
    normalizedUrl,
    data,
    warnings: buildWarnings(data, page, new Date(now())),
    model: ai.model,
    usedStructuredData: page.structured !== null,
    timings: { ...timings, total: now() - started },
    attempts,
  };
}
