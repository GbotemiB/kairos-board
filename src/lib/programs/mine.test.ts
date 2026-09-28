import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getMySubmissions,
  getOwnProgram,
  isProgramId,
  recordToFormValues,
  type ProgramRecord,
} from "@/lib/programs/mine";
import type { Database } from "@/lib/supabase/database.types";

const ID = "a0000000-0000-4000-8000-000000000001";

function fakeClient(terminal: "order" | "maybeSingle", result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "order", "maybeSingle"]) {
    builder[method] = vi.fn(() => (method === terminal ? Promise.resolve(result) : builder));
  }
  const client = { from: vi.fn(() => builder) };
  return { client: client as unknown as SupabaseClient<Database>, from: client.from, builder };
}

const RECORD: ProgramRecord = {
  id: ID,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  submitter_id: "user-1",
  url: "https://example.org/fellowship",
  url_normalized: "https://example.org/fellowship",
  title: "Graduate Fellowship",
  organization: null,
  type: "FELLOWSHIP",
  opens_at: null,
  deadline: "2026-11-15",
  deadline_type: "FIXED",
  eligibility: ["Master's students", "EU citizens"],
  location: "Lisbon",
  field: null,
  funding: null,
  status_override: "CLOSED",
  is_hidden: false,
};

describe("isProgramId", () => {
  it("accepts a UUID", () => {
    expect(isProgramId(ID)).toBe(true);
  });

  it.each(["", "123", "not-a-uuid", "a0000000-0000-4000-8000-00000000000Z", null, 42])(
    "rejects %j",
    (value) => {
      expect(isProgramId(value)).toBe(false);
    },
  );
});

describe("getMySubmissions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the user's own programs, newest first", async () => {
    const { client, from, builder } = fakeClient("order", { data: [], error: null });

    expect(await getMySubmissions(client, "user-1")).toEqual({ ok: true, programs: [] });
    expect(from).toHaveBeenCalledWith("programs");
    expect(builder.eq).toHaveBeenCalledWith("submitter_id", "user-1");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("returns a failure result when the query errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient("order", { data: null, error: { message: "down" } });

    expect(await getMySubmissions(client, "user-1")).toEqual({ ok: false });
  });
});

describe("getOwnProgram", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters by both id and submitter", async () => {
    const { client, builder } = fakeClient("maybeSingle", { data: RECORD, error: null });

    expect(await getOwnProgram(client, "user-1", ID)).toEqual(RECORD);
    expect(builder.eq).toHaveBeenCalledWith("id", ID);
    expect(builder.eq).toHaveBeenCalledWith("submitter_id", "user-1");
  });

  it("returns null for another user's program (no row)", async () => {
    const { client } = fakeClient("maybeSingle", { data: null, error: null });

    expect(await getOwnProgram(client, "user-1", ID)).toBeNull();
  });

  it("does not query the database for an invalid id", async () => {
    const { client, from } = fakeClient("maybeSingle", { data: RECORD, error: null });

    expect(await getOwnProgram(client, "user-1", "../../etc")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("returns null when the query errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient("maybeSingle", { data: null, error: { message: "down" } });

    expect(await getOwnProgram(client, "user-1", ID)).toBeNull();
  });
});

describe("recordToFormValues", () => {
  it("maps a stored program back to form values", () => {
    expect(recordToFormValues(RECORD)).toEqual({
      url: "https://example.org/fellowship",
      title: "Graduate Fellowship",
      organization: "",
      type: "FELLOWSHIP",
      opensAt: "",
      deadline: "2026-11-15",
      deadlineType: "FIXED",
      eligibility: "Master's students\nEU citizens",
      location: "Lisbon",
      field: "",
      funding: "",
      applicationsClosed: true,
    });
  });

  it("treats no override as open", () => {
    expect(recordToFormValues({ ...RECORD, status_override: null }).applicationsClosed).toBe(false);
  });
});
