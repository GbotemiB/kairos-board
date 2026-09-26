import { describe, expect, it } from "vitest";

import {
  FIELD_LIMITS,
  aiExtractionSchema,
  sanitizeExtraction,
  toGeminiSchema,
  type AiExtraction,
} from "@/lib/ai/schema";

/** Gemini's supported JSON Schema keywords (see GenerateContentConfig.responseJsonSchema). */
const SUPPORTED_KEYWORDS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

function collectKeywords(node: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((item) => collectKeywords(item, into));
  } else if (typeof node === "object" && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      into.add(key);
      // Property names under "properties" are field names, not keywords.
      if (key === "properties" && typeof value === "object" && value !== null) {
        Object.values(value).forEach((child) => collectKeywords(child, into));
      } else {
        collectKeywords(value, into);
      }
    }
  }
  return into;
}

function raw(overrides: Partial<AiExtraction> = {}): AiExtraction {
  return {
    title: "Graduate Fellowship",
    organization: "Example Foundation",
    type: "FELLOWSHIP",
    opensAt: null,
    deadline: "2026-11-15",
    deadlineType: "FIXED",
    eligibility: ["Master's students"],
    location: "Lisbon, Portugal",
    field: "Climate policy",
    funding: "Monthly stipend",
    applicationsClosed: false,
    openToMasters: "YES",
    ...overrides,
  };
}

describe("toGeminiSchema", () => {
  const schema = toGeminiSchema();

  it("only uses keywords Gemini supports", () => {
    const unsupported = [...collectKeywords(schema)].filter((key) => !SUPPORTED_KEYWORDS.has(key));
    expect(unsupported).toEqual([]);
  });

  it("requires every field so the model always returns a complete object", () => {
    expect(schema["required"]).toEqual(Object.keys(aiExtractionSchema.shape));
  });

  it("constrains the enums", () => {
    const properties = schema["properties"] as Record<string, { enum?: string[] }>;
    expect(properties["type"].enum).toEqual(["INTERNSHIP", "FELLOWSHIP", "PROGRAM", "OTHER"]);
    expect(properties["deadlineType"].enum).toEqual(["FIXED", "ROLLING", "UNKNOWN"]);
    expect(properties["openToMasters"].enum).toEqual(["YES", "NO", "UNCLEAR"]);
  });

  it("forbids extra properties", () => {
    expect(schema["additionalProperties"]).toBe(false);
  });
});

describe("aiExtractionSchema", () => {
  it("accepts a complete response", () => {
    expect(aiExtractionSchema.safeParse(raw()).success).toBe(true);
  });

  it.each([
    ["an unknown type", { type: "JOB" }],
    ["a missing field", { title: undefined }],
    ["a non-array eligibility", { eligibility: "Master's" }],
  ])("rejects %s", (_name, overrides) => {
    expect(aiExtractionSchema.safeParse({ ...raw(), ...overrides }).success).toBe(false);
  });
});

describe("sanitizeExtraction", () => {
  it("keeps clean values unchanged", () => {
    expect(sanitizeExtraction(raw())).toEqual(raw());
  });

  it("trims and collapses whitespace, turning blank strings into null", () => {
    const result = sanitizeExtraction(
      raw({ title: "  Graduate \n Fellowship ", organization: "   ", funding: "" }),
    );

    expect(result).toMatchObject({
      title: "Graduate Fellowship",
      organization: null,
      funding: null,
    });
  });

  it.each(["2026-02-30", "15 November 2026", "2026-11-15T00:00:00Z", "soon"])(
    "drops the invalid deadline %j and marks a fixed deadline as unknown",
    (deadline) => {
      expect(sanitizeExtraction(raw({ deadline }))).toMatchObject({
        deadline: null,
        deadlineType: "UNKNOWN",
      });
    },
  );

  it("keeps a rolling deadline type without a date", () => {
    expect(sanitizeExtraction(raw({ deadline: null, deadlineType: "ROLLING" }))).toMatchObject({
      deadline: null,
      deadlineType: "ROLLING",
    });
  });

  it("drops opensAt when it is after the deadline", () => {
    expect(
      sanitizeExtraction(raw({ opensAt: "2026-12-01", deadline: "2026-11-15" })).opensAt,
    ).toBeNull();
  });

  it("keeps opensAt when it precedes the deadline", () => {
    expect(sanitizeExtraction(raw({ opensAt: "2026-10-01" })).opensAt).toBe("2026-10-01");
  });

  it("clamps overly long text to the database limits with an ellipsis", () => {
    const result = sanitizeExtraction(raw({ title: "a".repeat(500), funding: "b".repeat(900) }));

    expect(result.title).toHaveLength(FIELD_LIMITS.title);
    expect(result.title?.endsWith("…")).toBe(true);
    expect(result.funding).toHaveLength(FIELD_LIMITS.funding);
  });

  it("dedupes eligibility case-insensitively and drops blanks", () => {
    const result = sanitizeExtraction(
      raw({ eligibility: ["Master's students", "  ", "master's STUDENTS", "EU citizens"] }),
    );

    expect(result.eligibility).toEqual(["Master's students", "EU citizens"]);
  });

  it(`caps eligibility at ${FIELD_LIMITS.eligibilityCount} items`, () => {
    const eligibility = Array.from({ length: 40 }, (_, i) => `Criterion ${i}`);

    expect(sanitizeExtraction(raw({ eligibility })).eligibility).toHaveLength(
      FIELD_LIMITS.eligibilityCount,
    );
  });
});
