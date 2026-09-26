import { describe, expect, it } from "vitest";

import { EMPTY_EXTRACTION, mergeExtraction } from "@/lib/ai/merge";
import type { ExtractedProgram } from "@/lib/ai/schema";
import type { StructuredHints } from "@/lib/scrape/json-ld";
import type { PageMeta } from "@/lib/scrape/read-page";

const META: PageMeta = { title: "Page Title", siteName: "Site Name", description: null };
const NO_META: PageMeta = { title: null, siteName: null, description: null };

const AI: ExtractedProgram = {
  title: "AI Title",
  organization: "AI Org",
  type: "FELLOWSHIP",
  opensAt: "2026-10-01",
  deadline: "2026-11-15",
  deadlineType: "FIXED",
  eligibility: ["Master's students"],
  location: "AI City",
  field: "Climate",
  funding: "Stipend",
  applicationsClosed: false,
};

const STRUCTURED: StructuredHints = {
  source: "JobPosting",
  title: "Structured Title",
  organization: "Structured Org",
  deadline: "2026-12-01",
  location: "Berlin, DE",
  type: "INTERNSHIP",
};

describe("mergeExtraction", () => {
  it("returns the AI result when there is no structured data", () => {
    expect(mergeExtraction(AI, null, META)).toEqual(AI);
  });

  it("lets structured data win over the AI", () => {
    expect(mergeExtraction(AI, STRUCTURED, META)).toEqual({
      ...AI,
      title: "Structured Title",
      organization: "Structured Org",
      type: "INTERNSHIP",
      deadline: "2026-12-01",
      deadlineType: "FIXED",
      location: "Berlin, DE",
    });
  });

  it("keeps AI values where structured fields are missing", () => {
    const partial: StructuredHints = {
      ...STRUCTURED,
      organization: null,
      deadline: null,
      location: null,
      type: null,
    };

    expect(mergeExtraction(AI, partial, META)).toMatchObject({
      title: "Structured Title",
      organization: "AI Org",
      type: "FELLOWSHIP",
      deadline: "2026-11-15",
      deadlineType: "FIXED",
      location: "AI City",
    });
  });

  it("marks a structured deadline as fixed even if the AI said rolling", () => {
    expect(
      mergeExtraction({ ...AI, deadline: null, deadlineType: "ROLLING" }, STRUCTURED, META)
        .deadlineType,
    ).toBe("FIXED");
  });

  it("drops opensAt when the structured deadline comes before it", () => {
    const result = mergeExtraction(
      { ...AI, opensAt: "2026-12-10" },
      { ...STRUCTURED, deadline: "2026-12-01" },
      META,
    );

    expect(result.opensAt).toBeNull();
  });

  it("uses page metadata when the AI found no title or organization", () => {
    expect(mergeExtraction({ ...AI, title: null, organization: null }, null, META)).toMatchObject({
      title: "Page Title",
      organization: "Site Name",
    });
  });

  it("builds a partial result from structured data when the AI failed", () => {
    expect(mergeExtraction(null, STRUCTURED, NO_META)).toEqual({
      ...EMPTY_EXTRACTION,
      title: "Structured Title",
      organization: "Structured Org",
      type: "INTERNSHIP",
      deadline: "2026-12-01",
      deadlineType: "FIXED",
      location: "Berlin, DE",
    });
  });

  it("falls back to page metadata alone when there is nothing else", () => {
    expect(mergeExtraction(null, null, META)).toEqual({
      ...EMPTY_EXTRACTION,
      title: "Page Title",
      organization: "Site Name",
    });
  });
});
