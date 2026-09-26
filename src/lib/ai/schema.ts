import { z } from "zod";

import { parseDate } from "@/lib/programs/deadline";
import type { DeadlineType, ProgramType } from "@/lib/programs/types";

/**
 * What Gemini must return. Kept lean (types, enums, descriptions only) because
 * Gemini supports a subset of JSON Schema. Length limits and date validity are
 * enforced afterwards by `sanitizeExtraction`.
 */
export const aiExtractionSchema = z.object({
  title: z.string().describe("Official name of the program, fellowship or internship"),
  organization: z.string().nullable().describe("Who runs or hosts it"),
  type: z.enum(["INTERNSHIP", "FELLOWSHIP", "PROGRAM", "OTHER"]),
  opensAt: z.string().nullable().describe("Date applications open, YYYY-MM-DD"),
  deadline: z.string().nullable().describe("Date applications close, YYYY-MM-DD"),
  deadlineType: z.enum(["FIXED", "ROLLING", "UNKNOWN"]),
  eligibility: z.array(z.string()).describe("Short eligibility criteria, one per item"),
  location: z.string().nullable().describe('City and country, or "Remote"'),
  field: z.string().nullable().describe("Academic or professional field"),
  funding: z.string().nullable().describe("Stipend, salary or tuition support, briefly"),
  applicationsClosed: z
    .boolean()
    .describe("True only if the page explicitly says applications are closed"),
  openToMasters: z
    .enum(["YES", "NO", "UNCLEAR"])
    .describe("Whether master's students can apply, based on the stated eligibility"),
});

export type AiExtraction = z.infer<typeof aiExtractionSchema>;

/** JSON Schema for Gemini's `responseJsonSchema`. */
export function toGeminiSchema(): Record<string, unknown> {
  const schema: Record<string, unknown> = { ...z.toJSONSchema(aiExtractionSchema) };
  // Not in Gemini's supported JSON Schema subset.
  delete schema["$schema"];
  return schema;
}

/** Matches the `programs` table limits. */
export const FIELD_LIMITS = {
  title: 300,
  organization: 200,
  location: 200,
  field: 200,
  funding: 500,
  eligibilityItem: 300,
  eligibilityCount: 30,
} as const;

export type ExtractedProgram = {
  title: string | null;
  organization: string | null;
  type: ProgramType;
  opensAt: string | null;
  deadline: string | null;
  deadlineType: DeadlineType;
  eligibility: string[];
  location: string | null;
  field: string | null;
  funding: string | null;
  applicationsClosed: boolean;
  /** Review-only signal; not stored. */
  openToMasters: "YES" | "NO" | "UNCLEAR";
};

function cleanText(value: string | null, max: number): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed === "") {
    return null;
  }
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

function cleanDate(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return parseDate(trimmed) === null ? null : trimmed;
}

/**
 * Normalizes AI output to what the database accepts: trims, drops invalid
 * dates, clamps lengths, dedupes eligibility and fixes inconsistent dates.
 */
export function sanitizeExtraction(raw: AiExtraction): ExtractedProgram {
  let opensAt = cleanDate(raw.opensAt);
  const deadline = cleanDate(raw.deadline);
  if (opensAt !== null && deadline !== null && opensAt > deadline) {
    // Violates the programs_opens_before_deadline constraint; the deadline is what matters.
    opensAt = null;
  }

  const seen = new Set<string>();
  const eligibility: string[] = [];
  for (const item of raw.eligibility) {
    const cleaned = cleanText(item, FIELD_LIMITS.eligibilityItem);
    if (cleaned === null || seen.has(cleaned.toLowerCase())) {
      continue;
    }
    seen.add(cleaned.toLowerCase());
    eligibility.push(cleaned);
    if (eligibility.length === FIELD_LIMITS.eligibilityCount) {
      break;
    }
  }

  return {
    title: cleanText(raw.title, FIELD_LIMITS.title),
    organization: cleanText(raw.organization, FIELD_LIMITS.organization),
    type: raw.type,
    opensAt,
    deadline,
    // A fixed deadline without a date is not fixed.
    deadlineType: raw.deadlineType === "FIXED" && deadline === null ? "UNKNOWN" : raw.deadlineType,
    eligibility,
    location: cleanText(raw.location, FIELD_LIMITS.location),
    field: cleanText(raw.field, FIELD_LIMITS.field),
    funding: cleanText(raw.funding, FIELD_LIMITS.funding),
    applicationsClosed: raw.applicationsClosed,
    openToMasters: raw.openToMasters,
  };
}
