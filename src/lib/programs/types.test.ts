import { describe, expect, it } from "vitest";

import { toProgram, type ProgramRow } from "@/lib/programs/types";

const row: ProgramRow = {
  id: "a0000000-0000-0000-0000-000000000001",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  submitter_id: null,
  url: "https://example.org/fellowship",
  title: "Graduate Fellowship",
  organization: "Example Foundation",
  type: "FELLOWSHIP",
  opens_at: null,
  deadline: "2026-10-24",
  deadline_type: "FIXED",
  eligibility: ["Master's students"],
  location: "Remote",
  field: "Science",
  funding: "Stipend",
  status_override: null,
  status: "OPEN",
};

describe("toProgram", () => {
  it("maps a complete row", () => {
    expect(toProgram(row)).toEqual({
      id: row.id,
      title: "Graduate Fellowship",
      url: "https://example.org/fellowship",
      organization: "Example Foundation",
      type: "FELLOWSHIP",
      status: "OPEN",
      deadlineType: "FIXED",
      opensAt: null,
      deadline: "2026-10-24",
      eligibility: ["Master's students"],
      location: "Remote",
      field: "Science",
      funding: "Stipend",
    });
  });

  it.each(["id", "title", "url", "type", "status"] as const)(
    "returns null when required field %s is missing",
    (field) => {
      expect(toProgram({ ...row, [field]: null })).toBeNull();
    },
  );

  it("defaults a missing deadline_type to UNKNOWN", () => {
    expect(toProgram({ ...row, deadline_type: null })?.deadlineType).toBe("UNKNOWN");
  });

  it("defaults missing eligibility to an empty list", () => {
    expect(toProgram({ ...row, eligibility: null })?.eligibility).toEqual([]);
  });
});
