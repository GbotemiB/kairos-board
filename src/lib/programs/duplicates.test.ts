import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DUPLICATE_CHECK_TIMEOUT_MS, findProgramByNormalizedUrl } from "@/lib/programs/duplicates";
import type { Database } from "@/lib/supabase/database.types";

type QueryResult = {
  data: { id: string; title: string } | null;
  error: { message: string } | null;
};

function fakeClient(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    abortSignal: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  const client = { from: vi.fn(() => builder) };
  return { client: client as unknown as SupabaseClient<Database>, from: client.from, builder };
}

describe("findProgramByNormalizedUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("looks up the programs table by url_normalized", async () => {
    const { client, from, builder } = fakeClient({ data: null, error: null });

    await findProgramByNormalizedUrl(client, "https://example.org/apply");

    expect(from).toHaveBeenCalledWith("programs");
    expect(builder.select).toHaveBeenCalledWith("id, title");
    expect(builder.eq).toHaveBeenCalledWith("url_normalized", "https://example.org/apply");
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("times out the lookup so a slow database cannot use up the time budget", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const { client, builder } = fakeClient({ data: null, error: null });

    await findProgramByNormalizedUrl(client, "https://example.org/apply");

    expect(timeout).toHaveBeenCalledWith(DUPLICATE_CHECK_TIMEOUT_MS);
    expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    timeout.mockRestore();
  });

  it("returns the existing program when found", async () => {
    const { client } = fakeClient({ data: { id: "p1", title: "Fellowship" }, error: null });

    expect(await findProgramByNormalizedUrl(client, "https://example.org/apply")).toEqual({
      ok: true,
      existing: { id: "p1", title: "Fellowship" },
    });
  });

  it("returns null when there is no match", async () => {
    const { client } = fakeClient({ data: null, error: null });

    expect(await findProgramByNormalizedUrl(client, "https://example.org/new")).toEqual({
      ok: true,
      existing: null,
    });
  });

  it("returns a failure result and logs when the query errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { message: "timeout" };
    const { client } = fakeClient({ data: null, error });

    expect(await findProgramByNormalizedUrl(client, "https://example.org/apply")).toEqual({
      ok: false,
    });
    expect(consoleError).toHaveBeenCalledWith("Duplicate check failed", error);
  });
});
