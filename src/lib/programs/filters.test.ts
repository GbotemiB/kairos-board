import { describe, expect, it } from "vitest";

import {
  DEFAULT_FILTERS,
  MAX_QUERY_LENGTH,
  boardHref,
  hasActiveFilters,
  parseBoardFilters,
  statusesFor,
  toSearchParams,
  toSearchPattern,
  type BoardFilters,
} from "@/lib/programs/filters";

describe("parseBoardFilters", () => {
  it("uses the defaults when there are no params", () => {
    expect(parseBoardFilters({})).toEqual(DEFAULT_FILTERS);
    expect(DEFAULT_FILTERS.status).toBe("open-upcoming");
  });

  it("reads every filter", () => {
    expect(
      parseBoardFilters({
        status: "closed",
        type: ["FELLOWSHIP", "INTERNSHIP"],
        q: " climate ",
        sort: "newest",
        view: "list",
        page: "3",
      }),
    ).toEqual({
      status: "closed",
      types: ["INTERNSHIP", "FELLOWSHIP"],
      q: "climate",
      sort: "newest",
      view: "list",
      page: 3,
    });
  });

  it("accepts a single type and lowercase type names", () => {
    expect(parseBoardFilters({ type: "program" }).types).toEqual(["PROGRAM"]);
  });

  it("dedupes types and drops unknown ones", () => {
    expect(parseBoardFilters({ type: ["OTHER", "other", "JOB", ""] }).types).toEqual(["OTHER"]);
  });

  it.each([
    ["status", { status: "pending" }],
    ["sort", { sort: "random" }],
    ["view", { view: "grid" }],
  ])("falls back to the default for an unknown %s", (_name, params) => {
    expect(parseBoardFilters(params)).toEqual(DEFAULT_FILTERS);
  });

  it.each(["0", "-2", "abc", "", "1.5e9x"])("treats the page %j as page 1 when invalid", (page) => {
    expect(parseBoardFilters({ page }).page).toBe(page === "1.5e9x" ? 1 : 1);
  });

  it("uses the first value of a repeated single-value param", () => {
    expect(parseBoardFilters({ status: ["closed", "open"], q: ["a", "b"] })).toMatchObject({
      status: "closed",
      q: "a",
    });
  });

  it("collapses whitespace and limits the search length", () => {
    expect(parseBoardFilters({ q: "  data \n  science  " }).q).toBe("data science");
    expect(parseBoardFilters({ q: "x".repeat(500) }).q).toHaveLength(MAX_QUERY_LENGTH);
  });
});

describe("toSearchParams and boardHref", () => {
  it("omits defaults", () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe("");
    expect(boardHref(DEFAULT_FILTERS)).toBe("/");
  });

  it("round-trips through parseBoardFilters", () => {
    const filters: BoardFilters = {
      status: "all",
      types: ["INTERNSHIP", "OTHER"],
      q: "ai & ml",
      sort: "newest",
      view: "list",
      page: 2,
    };
    const params = Object.fromEntries(
      [...new Set(toSearchParams(filters).keys())].map((key) => [
        key,
        toSearchParams(filters).getAll(key),
      ]),
    );

    expect(parseBoardFilters(params)).toEqual(filters);
  });

  it("applies changes on top of the current filters", () => {
    const filters: BoardFilters = { ...DEFAULT_FILTERS, q: "climate", page: 3 };

    expect(boardHref(filters, { view: "list" })).toBe("/?q=climate&view=list&page=3");
    expect(boardHref(filters, { page: 1 })).toBe("/?q=climate");
  });

  it("encodes search text", () => {
    expect(boardHref({ ...DEFAULT_FILTERS, q: "a&b=c" })).toBe("/?q=a%26b%3Dc");
  });
});

describe("hasActiveFilters", () => {
  it("is false for the defaults, even in list view or on another page", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, view: "list", page: 4 })).toBe(false);
  });

  it.each<[string, Partial<BoardFilters>]>([
    ["status", { status: "all" }],
    ["type", { types: ["PROGRAM"] }],
    ["search", { q: "ai" }],
    ["sort", { sort: "newest" }],
  ])("is true when %s changes", (_name, change) => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, ...change })).toBe(true);
  });
});

describe("statusesFor", () => {
  it.each([
    ["open-upcoming", ["OPEN", "UPCOMING"]],
    ["open", ["OPEN"]],
    ["upcoming", ["UPCOMING"]],
    ["closed", ["CLOSED"]],
    ["all", null],
  ] as const)("maps %s", (option, statuses) => {
    expect(statusesFor(option)).toEqual(statuses);
  });
});

describe("toSearchPattern", () => {
  it("wraps the text in wildcards", () => {
    expect(toSearchPattern("climate fellowship")).toBe("%climate fellowship%");
  });

  it.each([
    ["commas and parentheses (or-filter syntax)", "a,title.eq.x)", "%a title.eq.x%"],
    ["quotes and backslashes", `"quoted" \\ it's`, "%quoted it s%"],
    ["user wildcards", "100% _ *", "%100%"],
    ["colons", "ai: ml", "%ai ml%"],
  ])("neutralizes %s", (_name, input, expected) => {
    expect(toSearchPattern(input)).toBe(expected);
  });

  it("returns null when nothing searchable is left", () => {
    expect(toSearchPattern("")).toBeNull();
    expect(toSearchPattern(" ,() ")).toBeNull();
  });
});
