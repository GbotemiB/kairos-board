import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BOARD_LIMIT, getBoardPrograms } from "@/lib/programs/queries";
import type { ProgramRow } from "@/lib/programs/types";
import type { Database } from "@/lib/supabase/database.types";

type QueryResult = { data: ProgramRow[] | null; error: { message: string } | null };

function fakeClient(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  const client = { from: vi.fn(() => builder) };
  return { client: client as unknown as SupabaseClient<Database>, from: client.from, builder };
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
    ...overrides,
  };
}

describe("getBoardPrograms", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queries the public view ordered by deadline with a row limit", async () => {
    const { client, from, builder } = fakeClient({ data: [], error: null });

    await getBoardPrograms(client);

    expect(from).toHaveBeenCalledWith("programs_public");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.order).toHaveBeenNthCalledWith(1, "deadline", {
      ascending: true,
      nullsFirst: false,
    });
    expect(builder.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(BOARD_LIMIT);
  });

  it("maps rows to programs", async () => {
    const { client } = fakeClient({
      data: [row({ id: "a", title: "Alpha", eligibility: ["Master's"] })],
      error: null,
    });

    const result = await getBoardPrograms(client);

    expect(result).toEqual({
      ok: true,
      programs: [expect.objectContaining({ id: "a", title: "Alpha", eligibility: ["Master's"] })],
    });
  });

  it("drops rows missing required fields", async () => {
    const { client } = fakeClient({
      data: [row({ id: "good" }), row({ id: "bad", title: null })],
      error: null,
    });

    const result = await getBoardPrograms(client);

    expect(result.ok && result.programs.map((program) => program.id)).toEqual(["good"]);
  });

  it("groups open, then upcoming, then closed, keeping deadline order within groups", async () => {
    // Rows arrive in deadline order from the database.
    const { client } = fakeClient({
      data: [
        row({ id: "closed-1", status: "CLOSED" }),
        row({ id: "open-1", status: "OPEN" }),
        row({ id: "upcoming-1", status: "UPCOMING" }),
        row({ id: "open-2", status: "OPEN" }),
        row({ id: "closed-2", status: "CLOSED" }),
        row({ id: "upcoming-2", status: "UPCOMING" }),
      ],
      error: null,
    });

    const result = await getBoardPrograms(client);

    expect(result.ok && result.programs.map((program) => program.id)).toEqual([
      "open-1",
      "open-2",
      "upcoming-1",
      "upcoming-2",
      "closed-1",
      "closed-2",
    ]);
  });

  it("returns an empty list when there are no programs", async () => {
    const { client } = fakeClient({ data: [], error: null });

    expect(await getBoardPrograms(client)).toEqual({ ok: true, programs: [] });
  });

  it("returns a failure result and logs when the query errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { message: "connection refused" };
    const { client } = fakeClient({ data: null, error });

    expect(await getBoardPrograms(client)).toEqual({ ok: false });
    expect(consoleError).toHaveBeenCalledWith("Failed to load board programs", error);
  });
});
