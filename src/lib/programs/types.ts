import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export type ProgramType = Enums["program_type"];
export type ProgramStatus = Enums["program_status"];
export type DeadlineType = Enums["deadline_type"];

export type ProgramRow = Database["public"]["Views"]["programs_public"]["Row"];

/** A board entry with required fields guaranteed. Dates are Postgres `YYYY-MM-DD` strings. */
export type Program = {
  id: string;
  title: string;
  url: string;
  organization: string | null;
  type: ProgramType;
  status: ProgramStatus;
  deadlineType: DeadlineType;
  opensAt: string | null;
  deadline: string | null;
  eligibility: string[];
  location: string | null;
  field: string | null;
  funding: string | null;
};

/**
 * Postgres marks every view column nullable. The underlying table enforces these
 * as NOT NULL, so a row missing one is unexpected and is skipped.
 */
export function toProgram(row: ProgramRow): Program | null {
  if (
    row.id === null ||
    row.title === null ||
    row.url === null ||
    row.type === null ||
    row.status === null
  ) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    url: row.url,
    organization: row.organization,
    type: row.type,
    status: row.status,
    deadlineType: row.deadline_type ?? "UNKNOWN",
    opensAt: row.opens_at,
    deadline: row.deadline,
    eligibility: row.eligibility ?? [],
    location: row.location,
    field: row.field,
    funding: row.funding,
  };
}

export const programTypeLabel: Record<ProgramType, string> = {
  INTERNSHIP: "Internship",
  FELLOWSHIP: "Fellowship",
  PROGRAM: "Program",
  OTHER: "Other",
};

export const programStatusLabel: Record<ProgramStatus, string> = {
  OPEN: "Open",
  UPCOMING: "Upcoming",
  CLOSED: "Closed",
};
