import type { Program } from "@/lib/programs/types";

const DAY_MS = 86_400_000;
/** Deadlines this close are highlighted. */
export const URGENT_DAYS = 14;

// Dates are stored without a time zone; treat them as UTC calendar days,
// matching `current_date` in the programs_public view.
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Parses a Postgres `YYYY-MM-DD` date as UTC midnight. Returns null if invalid. */
export function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  // Reject rollovers such as 2026-02-30.
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** Whole UTC calendar days from `now` to `date`. Negative when `date` is in the past. */
export function daysUntil(date: Date, now: Date): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((date.getTime() - today) / DAY_MS);
}

export type DeadlineTone = "urgent" | "normal" | "muted";

export type DeadlineInfo = {
  label: string;
  tone: DeadlineTone;
  /** Machine-readable date for `<time dateTime>`, when the label refers to one. */
  dateTime: string | null;
};

export function describeDeadline(
  program: Pick<Program, "status" | "deadline" | "deadlineType" | "opensAt">,
  now: Date,
): DeadlineInfo {
  const opensAt = program.opensAt === null ? null : parseDate(program.opensAt);
  if (program.status === "UPCOMING" && opensAt !== null) {
    return { label: `Opens ${formatDate(opensAt)}`, tone: "normal", dateTime: program.opensAt };
  }

  const deadline = program.deadline === null ? null : parseDate(program.deadline);
  if (deadline === null) {
    if (program.status === "CLOSED") {
      return { label: "Applications closed", tone: "muted", dateTime: null };
    }
    if (program.deadlineType === "ROLLING") {
      return { label: "Rolling deadline", tone: "normal", dateTime: null };
    }
    return { label: "Deadline not listed", tone: "muted", dateTime: null };
  }

  const days = daysUntil(deadline, now);
  const dateTime = program.deadline;

  if (days < 0) {
    return { label: `Closed ${formatDate(deadline)}`, tone: "muted", dateTime };
  }
  // Closed early via status_override, deadline still in the future.
  if (program.status === "CLOSED") {
    return { label: "Applications closed", tone: "muted", dateTime: null };
  }
  if (days === 0) {
    return { label: "Closes today", tone: "urgent", dateTime };
  }
  if (days === 1) {
    return { label: "Closes tomorrow", tone: "urgent", dateTime };
  }
  if (days <= URGENT_DAYS) {
    return { label: `Closes in ${days} days`, tone: "urgent", dateTime };
  }
  return { label: `Closes ${formatDate(deadline)}`, tone: "normal", dateTime };
}
