import type { ExtractedProgram } from "@/lib/ai/schema";
import type { StructuredHints } from "@/lib/scrape/json-ld";
import type { PageMeta } from "@/lib/scrape/read-page";

export const EMPTY_EXTRACTION: ExtractedProgram = {
  title: null,
  organization: null,
  type: "OTHER",
  opensAt: null,
  deadline: null,
  deadlineType: "UNKNOWN",
  eligibility: [],
  location: null,
  field: null,
  funding: null,
  applicationsClosed: false,
};

/**
 * Combines AI output with structured data and page metadata. Structured
 * (JSON-LD) values win where present; the AI fills everything else. With no
 * AI result, returns what structured data and metadata alone provide.
 */
export function mergeExtraction(
  ai: ExtractedProgram | null,
  structured: StructuredHints | null,
  meta: PageMeta,
): ExtractedProgram {
  const base = ai ?? EMPTY_EXTRACTION;
  if (structured === null) {
    return {
      ...base,
      title: base.title ?? meta.title,
      organization: base.organization ?? meta.siteName,
    };
  }

  const deadline = structured.deadline ?? base.deadline;
  return {
    ...base,
    title: structured.title ?? base.title ?? meta.title,
    organization: structured.organization ?? base.organization ?? meta.siteName,
    type: structured.type ?? base.type,
    deadline,
    deadlineType: structured.deadline !== null ? "FIXED" : base.deadlineType,
    // Keep opensAt only if it still precedes the (possibly overridden) deadline.
    opensAt:
      base.opensAt !== null && deadline !== null && base.opensAt > deadline ? null : base.opensAt,
    location: structured.location ?? base.location,
  };
}
