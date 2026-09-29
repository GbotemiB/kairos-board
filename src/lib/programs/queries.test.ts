import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_FILTERS, PAGE_SIZE, type BoardFilters } from "@/lib/programs/filters";
import { getBoardPrograms } from "@/lib/programs/queries";
import type { ProgramRow } from "@/lib/programs/types";
import type { Database } from "@/lib/supabase/database.types";

type QueryResult = {
  data: ProgramRow[] | null;
  error: { message: string } | null;
  count: number | null;
};

type HeadResult = { error: { message: string } | null; count: number | null };

function fakeClient(result: QueryResult, headResult: HeadResult = { error: null, count: 0 }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  let isHead = false;
  for (const method of ["in", "or", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.select = (...args: unknown[]) => {
    calls.push(["select", ...args]);
    isHead = (args[1] as { head?: boolean }).head === true;
    return builder;
  };
  builder.range = (...args: unknown[]) => {
    calls.push(["range", ...args]);
    return Promise.resolve(result);
  };
  // Awaiting the builder itself runs the head (count-only) query.
  builder.then = (resolve: (value: HeadResult) => unknown) =>
    resolve(isHead ? headResult : ({} as HeadResult));
  const client = { from: vi.fn(() => builder) };
  return { client: client as unknown as SupabaseClient<Database>, from: client.from, calls };
}

function row(overrides: Partial<ProgramRow>): ProgramRow {
  return {
    id: "id",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    submitter_id: null,
    url: "https://example.org",
    title: "Program",
    organization: null,
    type: "PROGRAM",
    opens_at: null,
    deadline: null,
    deadline_type: "UNKNOWN",
    eligibility: [],
    location: null,
    field: null,
    funding: null,
    status_override: null,
    status: "OPEN",
    status_rank: 0,
    ...overrides,
  };
}

function filters(overrides: Partial<BoardFilters> = {}): BoardFilters {
  return { ...DEFAULT_FILTERS, ...overrides };
}

describe("getBoardPrograms", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("by default shows open and upcoming programs, grouped by status then deadline", async () => {
    const { client, from, calls } = fakeClient({ data: [], error: null, count: 0 });

    await getBoardPrograms(client, filters());

    expect(from).toHaveBeenCalledWith("programs_public");
    expect(calls).toEqual([
      ["select", "*", { count: "exact", head: false }],
      ["in", "status", ["OPEN", "UPCOMING"]],
      ["order", "status_rank", { ascending: true }],
      ["order", "deadline", { ascending: true, nullsFirst: false }],
      ["order", "created_at", { ascending: false }],
      ["range", 0, PAGE_SIZE - 1],
    ]);
  });

  it("does not filter by status for 'all'", async () => {
    const { client, calls } = fakeClient({ data: [], error: null, count: 0 });

    await getBoardPrograms(client, filters({ status: "all" }));

    expect(calls.some(([method, column]) => method === "in" && column === "status")).toBe(false);
  });

  it("filters by type and searches title and organization safely", async () => {
    const { client, calls } = fakeClient({ data: [], error: null, count: 0 });

    await getBoardPrograms(
      client,
      filters({ status: "closed", types: ["INTERNSHIP"], q: "data,science)" }),
    );

    expect(calls).toContainEqual(["in", "status", ["CLOSED"]]);
    expect(calls).toContainEqual(["in", "type", ["INTERNSHIP"]]);
    expect(calls).toContainEqual([
      "or",
      "title.ilike.%data science%,organization.ilike.%data science%",
    ]);
  });

  it("sorts by newest when asked", async () => {
    const { client, calls } = fakeClient({ data: [], error: null, count: 0 });

    await getBoardPrograms(client, filters({ sort: "newest" }));

    expect(calls.filter(([method]) => method === "order")).toEqual([
      ["order", "created_at", { ascending: false }],
    ]);
  });

  it("requests the right page range", async () => {
    const { client, calls } = fakeClient({ data: [], error: null, count: 0 });

    await getBoardPrograms(client, filters({ page: 3 }));

    expect(calls.at(-1)).toEqual(["range", 2 * PAGE_SIZE, 3 * PAGE_SIZE - 1]);
  });

  it("maps rows, drops invalid ones, and reports totals and page count", async () => {
    const { client } = fakeClient({
      data: [row({ id: "a", title: "Alpha" }), row({ id: "bad", title: null })],
      error: null,
      count: PAGE_SIZE * 2 + 1,
    });

    const result = await getBoardPrograms(client, filters({ page: 2 }));

    expect(result).toMatchObject({ ok: true, total: PAGE_SIZE * 2 + 1, page: 2, pageCount: 3 });
    expect(result.ok && result.programs.map((program) => program.id)).toEqual(["a"]);
  });

  it("reports at least one page when there are no results", async () => {
    const { client } = fakeClient({ data: [], error: null, count: 0 });

    expect(await getBoardPrograms(client, filters())).toMatchObject({
      ok: true,
      total: 0,
      pageCount: 1,
    });
  });

  it("returns an empty page with the real total when the page is past the end", async () => {
    const { client, calls } = fakeClient(
      {
        data: null,
        error: { message: "Requested range not satisfiable", code: "PGRST103" } as never,
        count: null,
      },
      { error: null, count: 5 },
    );

    const result = await getBoardPrograms(client, filters({ page: 9, q: "ai" }));

    expect(result).toEqual({ ok: true, programs: [], total: 5, page: 9, pageCount: 1 });
    // The count query uses the same filters.
    expect(calls.filter(([method]) => method === "select").at(-1)).toEqual([
      "select",
      "*",
      { count: "exact", head: true },
    ]);
    expect(calls.filter(([method]) => method === "or")).toHaveLength(2);
  });

  it("fails when the count fallback also fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient(
      { data: null, error: { message: "range", code: "PGRST103" } as never, count: null },
      { error: { message: "down" }, count: null },
    );

    expect(await getBoardPrograms(client, filters({ page: 9 }))).toEqual({ ok: false });
  });

  it("returns a failure result and logs when the query errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { message: "connection refused" };
    const { client } = fakeClient({ data: null, error, count: null });

    expect(await getBoardPrograms(client, filters())).toEqual({ ok: false });
    expect(consoleError).toHaveBeenCalledWith("Failed to load board programs", error);
  });
});
