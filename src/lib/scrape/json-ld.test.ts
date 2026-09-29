// @vitest-environment node
import { load } from "cheerio";
import { describe, expect, it } from "vitest";

import { extractJsonLd } from "@/lib/scrape/json-ld";

function withJsonLd(...blocks: string[]) {
  return load(
    `<html><head>${blocks
      .map((block) => `<script type="application/ld+json">${block}</script>`)
      .join("")}</head><body></body></html>`,
  );
}

describe("extractJsonLd", () => {
  it("returns null when there is no JSON-LD", () => {
    expect(extractJsonLd(load("<html><body><p>Hi</p></body></html>"))).toBeNull();
  });

  it("reads a JobPosting", () => {
    const $ = withJsonLd(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: "Research Intern",
        hiringOrganization: { "@type": "Organization", name: "Example Lab" },
        validThrough: "2026-11-30T23:59:59Z",
        employmentType: "INTERN",
        jobLocation: {
          "@type": "Place",
          address: { addressLocality: "London", addressRegion: "London", addressCountry: "UK" },
        },
      }),
    );

    expect(extractJsonLd($)).toEqual({
      source: "JobPosting",
      title: "Research Intern",
      organization: "Example Lab",
      deadline: "2026-11-30",
      location: "London, UK",
      type: "INTERNSHIP",
    });
  });

  it("accepts a string organization and a date-only deadline", () => {
    const $ = withJsonLd(
      JSON.stringify({
        "@type": "JobPosting",
        title: "Fellow",
        hiringOrganization: "Example Foundation",
        validThrough: "2026-12-01",
      }),
    );

    expect(extractJsonLd($)).toMatchObject({
      organization: "Example Foundation",
      deadline: "2026-12-01",
      type: null,
    });
  });

  it("maps TELECOMMUTE to Remote", () => {
    const $ = withJsonLd(
      JSON.stringify({
        "@type": "JobPosting",
        title: "Remote Intern",
        jobLocationType: "TELECOMMUTE",
      }),
    );

    expect(extractJsonLd($)?.location).toBe("Remote");
  });

  it("uses the first usable location from a list", () => {
    const $ = withJsonLd(
      JSON.stringify({
        "@type": "JobPosting",
        title: "Intern",
        jobLocation: [
          null,
          {
            "@type": "Place",
            address: { addressLocality: "Paris", addressCountry: { name: "France" } },
          },
        ],
      }),
    );

    expect(extractJsonLd($)?.location).toBe("Paris, France");
  });

  it("finds a JobPosting inside an @graph container", () => {
    const $ = withJsonLd(
      JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebPage", name: "Careers" },
          { "@type": "JobPosting", title: "Graph Intern" },
        ],
      }),
    );

    expect(extractJsonLd($)?.title).toBe("Graph Intern");
  });

  it("finds a JobPosting in a top-level array and a multi-valued @type", () => {
    const $ = withJsonLd(
      JSON.stringify([
        { "@type": "Organization", name: "Org" },
        { "@type": ["Thing", "JobPosting"], title: "Array Intern" },
      ]),
    );

    expect(extractJsonLd($)?.title).toBe("Array Intern");
  });

  it("reads an EducationalOccupationalProgram", () => {
    const $ = withJsonLd(
      JSON.stringify({
        "@type": "EducationalOccupationalProgram",
        name: "Summer School in Data Ethics",
        provider: { "@type": "CollegeOrUniversity", name: "Example University" },
        applicationDeadline: "2027-01-15",
      }),
    );

    expect(extractJsonLd($)).toEqual({
      source: "EducationalOccupationalProgram",
      title: "Summer School in Data Ethics",
      organization: "Example University",
      deadline: "2027-01-15",
      location: null,
      type: "PROGRAM",
    });
  });

  it("prefers a JobPosting over a program when both exist", () => {
    const $ = withJsonLd(
      JSON.stringify({ "@type": "EducationalOccupationalProgram", name: "Program" }),
      JSON.stringify({ "@type": "JobPosting", title: "Job" }),
    );

    expect(extractJsonLd($)?.source).toBe("JobPosting");
  });

  it("skips malformed blocks and keeps reading the rest", () => {
    const $ = withJsonLd(
      "{ not valid json",
      JSON.stringify({ "@type": "JobPosting", title: "Survivor" }),
    );

    expect(extractJsonLd($)?.title).toBe("Survivor");
  });

  it.each(["not a date", "2026-02-30", "30/11/2026"])(
    "ignores the invalid deadline %j",
    (validThrough) => {
      const $ = withJsonLd(JSON.stringify({ "@type": "JobPosting", title: "X", validThrough }));

      expect(extractJsonLd($)?.deadline).toBeNull();
    },
  );

  it("collapses whitespace and treats blank strings as missing", () => {
    const $ = withJsonLd(
      JSON.stringify({
        "@type": "JobPosting",
        title: "  Data\n   Intern ",
        hiringOrganization: "   ",
      }),
    );

    expect(extractJsonLd($)).toMatchObject({ title: "Data Intern", organization: null });
  });

  it("ignores unrelated schema types", () => {
    const $ = withJsonLd(JSON.stringify({ "@type": "Organization", name: "Example" }));

    expect(extractJsonLd($)).toBeNull();
  });
});
