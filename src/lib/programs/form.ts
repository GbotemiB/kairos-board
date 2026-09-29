import type { ExtractedProgram } from "@/lib/ai/schema";
import { FIELD_LIMITS } from "@/lib/ai/schema";
import { parseDate } from "@/lib/programs/deadline";
import type { DeadlineType, ProgramType } from "@/lib/programs/types";
import type { Database } from "@/lib/supabase/database.types";
import { normalizeUrl } from "@/lib/url/normalize";
import { validateUrl } from "@/lib/url/validate";

/** Raw form values, as strings, so a failed submission can repopulate the form. */
export type ProgramFormValues = {
  url: string;
  title: string;
  organization: string;
  type: ProgramType;
  opensAt: string;
  deadline: string;
  deadlineType: DeadlineType;
  /** One criterion per line. */
  eligibility: string;
  location: string;
  field: string;
  funding: string;
  applicationsClosed: boolean;
};

export type ProgramFormField = keyof ProgramFormValues;
export type ProgramFieldErrors = Partial<Record<ProgramFormField, string>>;

export type ProgramInsert = Pick<
  Database["public"]["Tables"]["programs"]["Insert"],
  | "url"
  | "url_normalized"
  | "title"
  | "organization"
  | "type"
  | "opens_at"
  | "deadline"
  | "deadline_type"
  | "eligibility"
  | "location"
  | "field"
  | "funding"
  | "status_override"
>;

const PROGRAM_TYPES: readonly ProgramType[] = ["INTERNSHIP", "FELLOWSHIP", "PROGRAM", "OTHER"];
const DEADLINE_TYPES: readonly DeadlineType[] = ["FIXED", "ROLLING", "UNKNOWN"];

export const EMPTY_FORM_VALUES: ProgramFormValues = {
  url: "",
  title: "",
  organization: "",
  type: "OTHER",
  opensAt: "",
  deadline: "",
  deadlineType: "UNKNOWN",
  eligibility: "",
  location: "",
  field: "",
  funding: "",
  applicationsClosed: false,
};

/** Pre-fills the review form from an extraction result. */
export function toFormValues(url: string, data: ExtractedProgram): ProgramFormValues {
  return {
    url,
    title: data.title ?? "",
    organization: data.organization ?? "",
    type: data.type,
    opensAt: data.opensAt ?? "",
    deadline: data.deadline ?? "",
    deadlineType: data.deadlineType,
    eligibility: data.eligibility.join("\n"),
    location: data.location ?? "",
    field: data.field ?? "",
    funding: data.funding ?? "",
    applicationsClosed: data.applicationsClosed,
  };
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function readFormValues(formData: FormData): ProgramFormValues {
  const type = text(formData, "type");
  const deadlineType = text(formData, "deadlineType");
  return {
    url: text(formData, "url"),
    title: text(formData, "title"),
    organization: text(formData, "organization"),
    type: (PROGRAM_TYPES as readonly string[]).includes(type) ? (type as ProgramType) : "OTHER",
    opensAt: text(formData, "opensAt"),
    deadline: text(formData, "deadline"),
    deadlineType: (DEADLINE_TYPES as readonly string[]).includes(deadlineType)
      ? (deadlineType as DeadlineType)
      : "UNKNOWN",
    eligibility: text(formData, "eligibility"),
    location: text(formData, "location"),
    field: text(formData, "field"),
    funding: text(formData, "funding"),
    applicationsClosed: formData.get("applicationsClosed") === "on",
  };
}

function optional(value: string): string | null {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed === "" ? null : trimmed;
}

export type ProgramParseResult =
  { ok: true; program: ProgramInsert } | { ok: false; fieldErrors: ProgramFieldErrors };

/**
 * Validates submitted form values into a row for `programs`. Limits mirror the
 * table's check constraints so users get a field message instead of a DB error.
 */
export function parseProgramForm(values: ProgramFormValues): ProgramParseResult {
  const fieldErrors: ProgramFieldErrors = {};

  const validatedUrl = validateUrl(values.url);
  if (!validatedUrl.ok) {
    fieldErrors.url = validatedUrl.message;
  }

  const title = optional(values.title);
  if (title === null) {
    fieldErrors.title = "Add the program name.";
  } else if (title.length > FIELD_LIMITS.title) {
    fieldErrors.title = `Use at most ${FIELD_LIMITS.title} characters.`;
  }

  const limited: Array<[ProgramFormField, string | null, number]> = [
    ["organization", optional(values.organization), FIELD_LIMITS.organization],
    ["location", optional(values.location), FIELD_LIMITS.location],
    ["field", optional(values.field), FIELD_LIMITS.field],
    ["funding", optional(values.funding), FIELD_LIMITS.funding],
  ];
  for (const [name, value, max] of limited) {
    if (value !== null && value.length > max) {
      fieldErrors[name] = `Use at most ${max} characters.`;
    }
  }

  const deadline = optional(values.deadline);
  if (deadline !== null && parseDate(deadline) === null) {
    fieldErrors.deadline = "Enter a valid date.";
  }
  const opensAt = optional(values.opensAt);
  if (opensAt !== null && parseDate(opensAt) === null) {
    fieldErrors.opensAt = "Enter a valid date.";
  }
  if (
    fieldErrors.deadline === undefined &&
    fieldErrors.opensAt === undefined &&
    opensAt !== null &&
    deadline !== null &&
    opensAt > deadline
  ) {
    fieldErrors.opensAt = "The opening date must be on or before the deadline.";
  }

  const eligibility = [
    ...new Set(
      values.eligibility
        .split("\n")
        .map(optional)
        .filter((item) => item !== null),
    ),
  ];
  if (eligibility.length > FIELD_LIMITS.eligibilityCount) {
    fieldErrors.eligibility = `List at most ${FIELD_LIMITS.eligibilityCount} criteria.`;
  } else if (eligibility.some((item) => item.length > FIELD_LIMITS.eligibilityItem)) {
    fieldErrors.eligibility = `Keep each criterion under ${FIELD_LIMITS.eligibilityItem} characters.`;
  }

  if (!validatedUrl.ok || title === null || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    program: {
      url: validatedUrl.url.href,
      url_normalized: normalizeUrl(validatedUrl.url),
      title,
      organization: limited[0][1],
      type: values.type,
      opens_at: opensAt,
      deadline,
      // A fixed deadline needs a date.
      deadline_type:
        values.deadlineType === "FIXED" && deadline === null ? "UNKNOWN" : values.deadlineType,
      eligibility,
      location: limited[1][1],
      field: limited[2][1],
      funding: limited[3][1],
      status_override: values.applicationsClosed ? "CLOSED" : null,
    },
  };
}
