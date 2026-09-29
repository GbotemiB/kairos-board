import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  result: { data: [{ id: "x" }] as unknown, error: null as unknown },
  calls: [] as Array<[string, ...unknown[]]>,
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => {
    const builder: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ["update", "delete", "eq"]) {
      builder[method] = (...args: unknown[]) => {
        mocks.calls.push([method, ...args]);
        return builder;
      };
    }
    builder.select = () => Promise.resolve(mocks.result);
    return { from: () => builder };
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import { deleteProgram, updateProgram } from "@/app/my/actions";

const ID = "a0000000-0000-4000-8000-000000000001";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = {
  url: "https://example.org/fellowship",
  title: "Edited",
  type: "FELLOWSHIP",
  deadlineType: "UNKNOWN",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls = [];
  mocks.result = { data: [{ id: ID }], error: null };
  mocks.getCurrentUser.mockResolvedValue({ id: "user-1", email: null });
});

describe("updateProgram", () => {
  it("updates only the user's own row and redirects", async () => {
    await expect(updateProgram(ID, {}, form(VALID))).rejects.toThrow("REDIRECT:/my?updated=1");

    expect(mocks.calls).toEqual([
      [
        "update",
        expect.objectContaining({
          title: "Edited",
          url_normalized: "https://example.org/fellowship",
        }),
      ],
      ["eq", "id", ID],
      ["eq", "submitter_id", "user-1"],
    ]);
  });

  it("reports not found when no row matched (someone else's program)", async () => {
    mocks.result = { data: [], error: null };

    expect(await updateProgram(ID, {}, form(VALID))).toMatchObject({
      error: "This program could not be found.",
    });
  });

  it("rejects an invalid id without touching the database", async () => {
    expect(await updateProgram("nope", {}, form(VALID))).toMatchObject({
      error: "This program could not be found.",
    });
    expect(mocks.calls).toEqual([]);
  });

  it("returns validation errors with the submitted values", async () => {
    expect(await updateProgram(ID, { attempt: 1 }, form({ ...VALID, title: "" }))).toMatchObject({
      fieldErrors: { title: "Add the program name." },
      values: expect.objectContaining({ title: "" }),
      attempt: 2,
    });
    expect(mocks.calls).toEqual([]);
  });

  it("explains when the new link belongs to another program", async () => {
    mocks.result = { data: null, error: { code: "23505" } };

    expect(await updateProgram(ID, {}, form(VALID))).toMatchObject({
      error: "Another program on the board already uses this link.",
    });
  });

  it("requires a session", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    expect(await updateProgram(ID, {}, form(VALID))).toMatchObject({
      error: expect.stringMatching(/session/),
    });
    expect(mocks.calls).toEqual([]);
  });
});

describe("deleteProgram", () => {
  it("deletes only the user's own row and redirects", async () => {
    await expect(deleteProgram(ID)).rejects.toThrow("REDIRECT:/my?deleted=1");

    expect(mocks.calls).toEqual([["delete"], ["eq", "id", ID], ["eq", "submitter_id", "user-1"]]);
  });

  it("reports not found when no row matched", async () => {
    mocks.result = { data: [], error: null };

    expect(await deleteProgram(ID)).toEqual({ error: "This program could not be found." });
  });

  it("rejects an invalid id", async () => {
    expect(await deleteProgram("1 or 1=1")).toEqual({ error: "This program could not be found." });
    expect(mocks.calls).toEqual([]);
  });

  it("returns an error when the delete fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.result = { data: null, error: { code: "42501" } };

    expect(await deleteProgram(ID)).toEqual({
      error: "Couldn't delete the program. Please try again.",
    });
  });

  it("requires a session", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    expect(await deleteProgram(ID)).toMatchObject({ error: expect.stringMatching(/session/) });
  });
});
