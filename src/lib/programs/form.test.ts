import { describe, expect, it } from "vitest";

import type { ExtractedProgram } from "@/lib/ai/schema";
import {
  EMPTY_FORM_VALUES,
  parseProgramForm,
  readFormValues,
  toFormValues,
  type ProgramFormValues,
} from "@/lib/programs/form";

function values(overrides: Partial<ProgramFormValues> = {}): ProgramFormValues {
  return {
    url: "https://www.example.org/fellowship?utm_source=x",
    title: "Graduate Fellowship",
    organization: "Example Foundation",
    type: "FELLOWSHIP",
    opensAt: "2026-10-01",
    deadline: "2026-11-15",
    deadlineType: "FIXED",
    eligibility: "Master's students\nEU citizens",
    location: "Lisbon, Portugal",
    field: "Climate",
    funding: "Stipend",
    applicationsClosed: false,
    ...overrides,
  };
}

function expectErrors(overrides: Partial<ProgramFormValues>) {
  const result = parseProgramForm(values(overrides));
  if (result.ok) throw new Error("expected validation errors");
  return result.fieldErrors;
}

describe("parseProgramForm", () => {
  it("builds a programs row with a normalized URL", () => {
    expect(parseProgramForm(values())).toEqual({
      ok: true,
      program: {
        url: "https://www.example.org/fellowship?utm_source=x",
        url_normalized: "https://example.org/fellowship",
        title: "Graduate Fellowship",
        organization: "Example Foundation",
        type: "FELLOWSHIP",
        opens_at: "2026-10-01",
        deadline: "2026-11-15",
        deadline_type: "FIXED",
        eligibility: ["Master's students", "EU citizens"],
        location: "Lisbon, Portugal",
        field: "Climate",
        funding: "Stipend",
        status_override: null,
      },
    });
  });

  it("turns blank optional fields into null and trims whitespace", () => {
    const result = parseProgramForm(
      values({
        title: "  Graduate   Fellowship ",
        organization: "  ",
        location: "",
        opensAt: "",
        deadline: "",
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      program: {
        title: "Graduate Fellowship",
        organization: null,
        location: null,
        opens_at: null,
        deadline: null,
      },
    });
  });

  it("marks a fixed deadline without a date as unknown", () => {
    expect(parseProgramForm(values({ deadline: "", deadlineType: "FIXED" }))).toMatchObject({
      program: { deadline_type: "UNKNOWN" },
    });
  });

  it("keeps a rolling deadline without a date", () => {
    expect(
      parseProgramForm(values({ deadline: "", deadlineType: "ROLLING", opensAt: "" })),
    ).toMatchObject({
      program: { deadline_type: "ROLLING" },
    });
  });

  it("sets the CLOSED override when applications are closed", () => {
    expect(parseProgramForm(values({ applicationsClosed: true }))).toMatchObject({
      program: { status_override: "CLOSED" },
    });
  });

  it("drops blank eligibility lines and duplicates", () => {
    expect(parseProgramForm(values({ eligibility: "One\n\n  \nOne\n Two " }))).toMatchObject({
      program: { eligibility: ["One", "Two"] },
    });
  });

  it("accepts a link without a scheme", () => {
    expect(parseProgramForm(values({ url: "example.org/apply" }))).toMatchObject({
      program: { url: "https://example.org/apply", url_normalized: "https://example.org/apply" },
    });
  });

  describe("errors", () => {
    it("requires a valid link", () => {
      expect(expectErrors({ url: "javascript:alert(1)" }).url).toBe(
        "Only http:// and https:// links are supported.",
      );
      expect(expectErrors({ url: "" }).url).toBe("Enter a link.");
    });

    it("requires a title", () => {
      expect(expectErrors({ title: "   " }).title).toBe("Add the program name.");
    });

    it("limits the title length", () => {
      expect(expectErrors({ title: "a".repeat(301) }).title).toBe("Use at most 300 characters.");
    });

    it.each([
      ["organization", 201],
      ["location", 201],
      ["field", 201],
      ["funding", 501],
    ] as const)("limits %s length", (name, length) => {
      expect(expectErrors({ [name]: "a".repeat(length) })[name]).toMatch(/Use at most/);
    });

    it.each(["2026-02-30", "15/11/2026", "soon"])("rejects the invalid deadline %j", (deadline) => {
      expect(expectErrors({ deadline }).deadline).toBe("Enter a valid date.");
    });

    it("rejects an invalid opening date", () => {
      expect(expectErrors({ opensAt: "2026-13-01" }).opensAt).toBe("Enter a valid date.");
    });

    it("rejects an opening date after the deadline", () => {
      expect(expectErrors({ opensAt: "2026-12-01", deadline: "2026-11-15" }).opensAt).toBe(
        "The opening date must be on or before the deadline.",
      );
    });

    it("limits the number of eligibility criteria", () => {
      const eligibility = Array.from({ length: 31 }, (_, i) => `Criterion ${i}`).join("\n");
      expect(expectErrors({ eligibility }).eligibility).toBe("List at most 30 criteria.");
    });

    it("limits the length of each criterion", () => {
      expect(expectErrors({ eligibility: "a".repeat(301) }).eligibility).toMatch(
        /under 300 characters/,
      );
    });

    it("reports several errors at once", () => {
      expect(Object.keys(expectErrors({ url: "", title: "", deadline: "bad" })).sort()).toEqual([
        "deadline",
        "title",
        "url",
      ]);
    });
  });
});

describe("readFormValues", () => {
  function form(fields: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  }

  it("reads every field", () => {
    expect(
      readFormValues(
        form({
          url: "https://example.org",
          title: "T",
          organization: "O",
          type: "INTERNSHIP",
          opensAt: "2026-10-01",
          deadline: "2026-11-01",
          deadlineType: "ROLLING",
          eligibility: "A\nB",
          location: "L",
          field: "F",
          funding: "M",
          applicationsClosed: "on",
        }),
      ),
    ).toEqual({
      url: "https://example.org",
      title: "T",
      organization: "O",
      type: "INTERNSHIP",
      opensAt: "2026-10-01",
      deadline: "2026-11-01",
      deadlineType: "ROLLING",
      eligibility: "A\nB",
      location: "L",
      field: "F",
      funding: "M",
      applicationsClosed: true,
    });
  });

  it("defaults missing fields and rejects unknown enum values", () => {
    expect(readFormValues(form({ type: "JOB", deadlineType: "SOMETIME" }))).toEqual(
      EMPTY_FORM_VALUES,
    );
  });
});

describe("toFormValues", () => {
  it("fills the form from an extraction", () => {
    const data: ExtractedProgram = {
      title: "Fellowship",
      organization: null,
      type: "FELLOWSHIP",
      opensAt: null,
      deadline: "2026-11-15",
      deadlineType: "FIXED",
      eligibility: ["Master's students", "EU citizens"],
      location: null,
      field: "Climate",
      funding: null,
      applicationsClosed: true,
      openToMasters: "YES",
    };

    expect(toFormValues("https://example.org/f", data)).toEqual({
      url: "https://example.org/f",
      title: "Fellowship",
      organization: "",
      type: "FELLOWSHIP",
      opensAt: "",
      deadline: "2026-11-15",
      deadlineType: "FIXED",
      eligibility: "Master's students\nEU citizens",
      location: "",
      field: "Climate",
      funding: "",
      applicationsClosed: true,
    });
  });
});
