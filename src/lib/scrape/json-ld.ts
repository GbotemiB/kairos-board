import type { CheerioAPI } from "cheerio";

import { parseDate } from "@/lib/programs/deadline";
import type { ProgramType } from "@/lib/programs/types";

/** Fields read from schema.org JSON-LD. More reliable than AI output when present. */
export type StructuredHints = {
  source: "JobPosting" | "EducationalOccupationalProgram";
  title: string | null;
  organization: string | null;
  /** `YYYY-MM-DD` */
  deadline: string | null;
  location: string | null;
  type: ProgramType | null;
};

type JsonObject = Record<string, unknown>;

const SUPPORTED_TYPES = ["JobPosting", "EducationalOccupationalProgram"] as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed === "" ? null : trimmed;
  }
  if (isObject(value)) {
    return asText(value["name"]);
  }
  if (Array.isArray(value)) {
    return asText(value[0]);
  }
  return null;
}

/** Accepts `2026-10-24` or an ISO datetime; returns the calendar date if valid. */
function asDate(value: unknown): string | null {
  const text = asText(value);
  if (text === null) {
    return null;
  }
  const date = text.slice(0, 10);
  return parseDate(date) === null ? null : date;
}

function typesOf(node: JsonObject): string[] {
  const type = node["@type"];
  if (typeof type === "string") {
    return [type];
  }
  return Array.isArray(type) ? type.filter((t): t is string => typeof t === "string") : [];
}

/** Flattens top-level arrays and `@graph` containers into a list of nodes. */
function collectNodes(value: unknown, into: JsonObject[] = []): JsonObject[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectNodes(item, into);
    }
  } else if (isObject(value)) {
    into.push(value);
    if (value["@graph"] !== undefined) {
      collectNodes(value["@graph"], into);
    }
  }
  return into;
}

function formatLocation(node: JsonObject): string | null {
  const locationType = asText(node["jobLocationType"]);
  if (locationType !== null && locationType.toUpperCase() === "TELECOMMUTE") {
    return "Remote";
  }
  const locations = Array.isArray(node["jobLocation"])
    ? node["jobLocation"]
    : [node["jobLocation"]];
  for (const location of locations) {
    if (!isObject(location)) {
      continue;
    }
    const address = location["address"];
    if (typeof address === "string") {
      return asText(address);
    }
    if (isObject(address)) {
      const parts = [
        asText(address["addressLocality"]),
        asText(address["addressRegion"]),
        asText(address["addressCountry"]),
      ].filter((part): part is string => part !== null);
      if (parts.length > 0) {
        return [...new Set(parts)].join(", ");
      }
    }
    const name = asText(location["name"]);
    if (name !== null) {
      return name;
    }
  }
  return null;
}

function employmentTypeToProgramType(value: unknown): ProgramType | null {
  const values = (Array.isArray(value) ? value : [value]).map((v) => asText(v)?.toUpperCase());
  return values.includes("INTERN") ? "INTERNSHIP" : null;
}

function fromJobPosting(node: JsonObject): StructuredHints {
  return {
    source: "JobPosting",
    title: asText(node["title"]) ?? asText(node["name"]),
    organization: asText(node["hiringOrganization"]),
    deadline: asDate(node["validThrough"]),
    location: formatLocation(node),
    type: employmentTypeToProgramType(node["employmentType"]),
  };
}

function fromProgram(node: JsonObject): StructuredHints {
  return {
    source: "EducationalOccupationalProgram",
    title: asText(node["name"]),
    organization: asText(node["provider"]),
    deadline: asDate(node["applicationDeadline"]),
    location: asText(node["location"]),
    type: "PROGRAM",
  };
}

/**
 * Reads the first schema.org JobPosting or EducationalOccupationalProgram from
 * the page's JSON-LD blocks. Invalid JSON blocks are skipped.
 */
export function extractJsonLd($: CheerioAPI): StructuredHints | null {
  const nodes: JsonObject[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      collectNodes(JSON.parse($(element).text()), nodes);
    } catch {
      // Malformed JSON-LD is common; ignore that block.
    }
  });

  for (const supported of SUPPORTED_TYPES) {
    const node = nodes.find((candidate) => typesOf(candidate).includes(supported));
    if (node !== undefined) {
      return supported === "JobPosting" ? fromJobPosting(node) : fromProgram(node);
    }
  }
  return null;
}
