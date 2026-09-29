import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EXTRACTIONS_PER_WINDOW,
  WINDOW_MS,
  checkRateLimit,
  recordExtraction,
} from "@/lib/extract/extraction-log";
import type { Database } from "@/lib/supabase/database.types";

const NOW = Date.parse("2026-09-28T12:00:00Z");

function selectClient(result: { data: { created_at: string }[] | null; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  const client = { from: vi.fn(() => builder) };
  return { client: client as unknown as SupabaseClient<Database>, from: client.from, builder };
}

function attemptsAgo(...minutesAgo: number[]) {
  return minutesAgo.map((minutes) => ({
    created_at: new Date(NOW - minutes * 60_000).toISOString(),
  }));
}

describe("checkRateLimit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queries the user's attempts within the window, oldest first", async () => {
    const { client, from, builder } = selectClient({ data: [], error: null });

    await checkRateLimit(client, "user-1", NOW);

    expect(from).toHaveBeenCalledWith("extraction_logs");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(builder.gte).toHaveBeenCalledWith("created_at", new Date(NOW - WINDOW_MS).toISOString());
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(EXTRACTIONS_PER_WINDOW);
  });

  it("allows a user under the limit and reports what is left", async () => {
    const { client } = selectClient({ data: attemptsAgo(50, 30, 10), error: null });

    expect(await checkRateLimit(client, "user-1", NOW)).toEqual({
      ok: true,
      allowed: true,
      remaining: EXTRACTIONS_PER_WINDOW - 3,
    });
  });

  it("blocks a user at the limit until the oldest attempt expires", async () => {
    const minutes = [45, ...Array.from({ length: EXTRACTIONS_PER_WINDOW - 1 }, () => 5)];
    const { client } = selectClient({ data: attemptsAgo(...minutes), error: null });

    // The attempt 45 minutes ago expires in 15 minutes.
    expect(await checkRateLimit(client, "user-1", NOW)).toEqual({
      ok: true,
      allowed: false,
      retryAfterSeconds: 15 * 60,
    });
  });

  it("never asks the user to wait less than one second", async () => {
    const minutes = [60, ...Array.from({ length: EXTRACTIONS_PER_WINDOW - 1 }, () => 1)];
    const { client } = selectClient({ data: attemptsAgo(...minutes), error: null });

    expect(await checkRateLimit(client, "user-1", NOW)).toMatchObject({ retryAfterSeconds: 1 });
  });

  it("fails closed when the query errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = selectClient({ data: null, error: { message: "db down" } });

    expect(await checkRateLimit(client, "user-1", NOW)).toEqual({ ok: false });
  });
});

describe("recordExtraction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function insertClient(error: unknown = null) {
    const insert = vi.fn<
      (row: { url_normalized: string; outcome: string }) => Promise<{ error: unknown }>
    >(() => Promise.resolve({ error }));
    const client = { from: vi.fn(() => ({ insert })) };
    return { client: client as unknown as SupabaseClient<Database>, from: client.from, insert };
  }

  it("inserts the outcome for the URL (user_id comes from the session default)", async () => {
    const { client, from, insert } = insertClient();

    await recordExtraction(client, "https://example.org/apply", "SUCCESS");

    expect(from).toHaveBeenCalledWith("extraction_logs");
    expect(insert).toHaveBeenCalledWith({
      url_normalized: "https://example.org/apply",
      outcome: "SUCCESS",
    });
  });

  it("truncates URLs to the column limit", async () => {
    const { client, insert } = insertClient();

    await recordExtraction(client, `https://example.org/${"a".repeat(3000)}`, "AI_FAILED");

    expect(insert.mock.calls[0][0]).toMatchObject({ url_normalized: expect.any(String) });
    expect((insert.mock.calls[0][0] as { url_normalized: string }).url_normalized).toHaveLength(
      2048,
    );
  });

  it("logs instead of throwing when the insert fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = insertClient({ message: "rls" });

    await expect(
      recordExtraction(client, "https://example.org", "SUCCESS"),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("Failed to record extraction", { message: "rls" });
  });
});
