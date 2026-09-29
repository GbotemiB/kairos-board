import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({ from: vi.fn(() => ({ insert: mocks.insert })) })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import { createProgram } from "@/app/submit/actions";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = {
  url: "https://example.org/fellowship",
  title: "Graduate Fellowship",
  type: "FELLOWSHIP",
  deadline: "2026-11-15",
  deadlineType: "FIXED",
  eligibility: "Master's students",
};

describe("createProgram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", email: "me@example.org" });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("inserts the parsed program and redirects to the board", async () => {
    await expect(createProgram({}, form(VALID))).rejects.toThrow("REDIRECT:/?added=1");

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.org/fellowship",
        url_normalized: "https://example.org/fellowship",
        title: "Graduate Fellowship",
        eligibility: ["Master's students"],
      }),
    );
  });

  it("never sends submitter_id or is_hidden (the database sets and guards them)", async () => {
    await expect(
      createProgram({}, form({ ...VALID, submitter_id: "someone-else", is_hidden: "true" })),
    ).rejects.toThrow();

    const row = mocks.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).not.toHaveProperty("submitter_id");
    expect(row).not.toHaveProperty("is_hidden");
  });

  it("returns field errors and the submitted values without inserting", async () => {
    const state = await createProgram({}, form({ ...VALID, title: "" }));

    expect(state).toMatchObject({
      fieldErrors: { title: "Add the program name." },
      values: expect.objectContaining({ url: "https://example.org/fellowship", title: "" }),
      attempt: 1,
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("increments the attempt counter on each failure", async () => {
    const state = await createProgram({ attempt: 2 }, form({ ...VALID, title: "" }));

    expect(state.attempt).toBe(3);
  });

  it("asks the user to sign in again when the session has expired", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    expect(await createProgram({}, form(VALID))).toMatchObject({
      error: "Your session has expired. Please sign in again.",
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("explains a duplicate caught by the unique constraint", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });

    expect(await createProgram({}, form(VALID))).toMatchObject({
      error: "This program is already on the board (or was hidden by a moderator).",
      values: expect.objectContaining({ title: "Graduate Fellowship" }),
    });
  });

  it("returns a generic error for other database failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.insert.mockResolvedValue({ error: { code: "42501", message: "permission denied" } });

    expect(await createProgram({}, form(VALID))).toMatchObject({
      error: "Couldn't save the program. Please try again.",
    });
  });
});
