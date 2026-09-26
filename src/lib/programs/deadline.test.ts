import { describe, expect, it } from "vitest";

import {
  URGENT_DAYS,
  daysUntil,
  describeDeadline,
  formatDate,
  parseDate,
  type DeadlineInfo,
} from "@/lib/programs/deadline";
import type { Program } from "@/lib/programs/types";

const NOW = new Date("2026-09-24T12:00:00Z");

type DeadlineInput = Pick<Program, "status" | "deadline" | "deadlineType" | "opensAt">;

function input(overrides: Partial<DeadlineInput>): DeadlineInput {
  return { status: "OPEN", deadline: null, deadlineType: "FIXED", opensAt: null, ...overrides };
}

describe("parseDate", () => {
  it("parses a YYYY-MM-DD date as UTC midnight", () => {
    expect(parseDate("2026-10-24")?.toISOString()).toBe("2026-10-24T00:00:00.000Z");
  });

  it("accepts a valid leap day", () => {
    expect(parseDate("2028-02-29")?.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it.each(["2027-02-29", "2026-02-30", "2026-13-01", "2026-00-10"])(
    "rejects the impossible date %s",
    (value) => {
      expect(parseDate(value)).toBeNull();
    },
  );

  it.each(["", "24/10/2026", "2026-10-24T00:00:00Z", "2026-1-5", "not a date"])(
    "rejects the malformed value %j",
    (value) => {
      expect(parseDate(value)).toBeNull();
    },
  );
});

describe("formatDate", () => {
  it("formats as day, short month, year in UTC", () => {
    expect(formatDate(new Date("2026-10-24T00:00:00Z"))).toBe("24 Oct 2026");
  });

  it("does not shift the day for late-UTC timestamps", () => {
    expect(formatDate(new Date("2026-10-24T23:59:59Z"))).toBe("24 Oct 2026");
  });
});

describe("daysUntil", () => {
  it("is 0 for today, whatever the time of day", () => {
    const today = new Date("2026-09-24T00:00:00Z");
    expect(daysUntil(today, new Date("2026-09-24T00:00:00Z"))).toBe(0);
    expect(daysUntil(today, new Date("2026-09-24T23:59:59Z"))).toBe(0);
  });

  it("counts whole days into the future", () => {
    expect(daysUntil(new Date("2026-09-25T00:00:00Z"), NOW)).toBe(1);
    expect(daysUntil(new Date("2026-10-24T00:00:00Z"), NOW)).toBe(30);
  });

  it("is negative for past dates", () => {
    expect(daysUntil(new Date("2026-09-23T00:00:00Z"), NOW)).toBe(-1);
  });
});

describe("describeDeadline", () => {
  const cases: Array<[string, Partial<DeadlineInput>, DeadlineInfo]> = [
    [
      "upcoming program shows the opening date",
      { status: "UPCOMING", opensAt: "2026-10-05", deadline: "2026-11-30" },
      { label: "Opens 5 Oct 2026", tone: "normal", dateTime: "2026-10-05" },
    ],
    [
      "rolling deadline without a date",
      { deadline: null, deadlineType: "ROLLING" },
      { label: "Rolling deadline", tone: "normal", dateTime: null },
    ],
    [
      "unknown deadline",
      { deadline: null, deadlineType: "UNKNOWN" },
      { label: "Deadline not listed", tone: "muted", dateTime: null },
    ],
    [
      "invalid stored date is treated as not listed",
      { deadline: "2026-02-30" },
      { label: "Deadline not listed", tone: "muted", dateTime: null },
    ],
    [
      "past deadline",
      { status: "CLOSED", deadline: "2026-08-10" },
      { label: "Closed 10 Aug 2026", tone: "muted", dateTime: "2026-08-10" },
    ],
    [
      "closed early via override with a future deadline",
      { status: "CLOSED", deadline: "2026-10-30" },
      { label: "Applications closed", tone: "muted", dateTime: null },
    ],
    [
      "closed with no deadline",
      { status: "CLOSED", deadline: null, deadlineType: "ROLLING" },
      { label: "Applications closed", tone: "muted", dateTime: null },
    ],
    [
      "deadline today",
      { deadline: "2026-09-24" },
      { label: "Closes today", tone: "urgent", dateTime: "2026-09-24" },
    ],
    [
      "deadline tomorrow",
      { deadline: "2026-09-25" },
      { label: "Closes tomorrow", tone: "urgent", dateTime: "2026-09-25" },
    ],
    [
      "deadline within the urgent window",
      { deadline: "2026-09-29" },
      { label: "Closes in 5 days", tone: "urgent", dateTime: "2026-09-29" },
    ],
    [
      "deadline exactly at the urgent boundary",
      { deadline: "2026-10-08" },
      { label: `Closes in ${URGENT_DAYS} days`, tone: "urgent", dateTime: "2026-10-08" },
    ],
    [
      "deadline just past the urgent boundary",
      { deadline: "2026-10-09" },
      { label: "Closes 9 Oct 2026", tone: "normal", dateTime: "2026-10-09" },
    ],
  ];

  it.each(cases)("%s", (_name, overrides, expected) => {
    expect(describeDeadline(input(overrides), NOW)).toEqual(expected);
  });

  it("falls back to the deadline when an upcoming program has no opening date", () => {
    expect(describeDeadline(input({ status: "UPCOMING", deadline: "2026-11-15" }), NOW)).toEqual({
      label: "Closes 15 Nov 2026",
      tone: "normal",
      dateTime: "2026-11-15",
    });
  });
});
