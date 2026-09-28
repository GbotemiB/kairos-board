import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProgramRecord } from "@/lib/programs/mine";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: null })),
  getOwnProgram: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn(async () => ({})) }));
vi.mock("@/lib/programs/mine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/programs/mine")>()),
  getOwnProgram: mocks.getOwnProgram,
}));
vi.mock("@/app/my/actions", () => ({
  updateProgram: { bind: vi.fn(() => vi.fn(async () => ({}))) },
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import EditProgramPage from "@/app/my/[id]/edit/page";

const ID = "a0000000-0000-4000-8000-000000000001";

const RECORD: ProgramRecord = {
  id: ID,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  submitter_id: "user-1",
  url: "https://example.org/fellowship",
  url_normalized: "https://example.org/fellowship",
  title: "Graduate Fellowship",
  organization: "Example Foundation",
  type: "FELLOWSHIP",
  opens_at: null,
  deadline: "2026-11-15",
  deadline_type: "FIXED",
  eligibility: ["Master's students"],
  location: null,
  field: null,
  funding: null,
  status_override: null,
  is_hidden: false,
};

function renderPage(id = ID) {
  return EditProgramPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
}

describe("Edit program page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires sign-in and returns to this page afterwards", async () => {
    mocks.getOwnProgram.mockResolvedValue(RECORD);

    render(await renderPage());

    expect(mocks.requireUser).toHaveBeenCalledWith(`/my/${ID}/edit`);
    expect(mocks.getOwnProgram).toHaveBeenCalledWith({}, "user-1", ID);
  });

  it("pre-fills the form with the stored program", async () => {
    mocks.getOwnProgram.mockResolvedValue(RECORD);

    render(await renderPage());

    expect(screen.getByRole("heading", { level: 1, name: "Edit program" })).toBeInTheDocument();
    expect(screen.getByLabelText("Program name")).toHaveValue("Graduate Fellowship");
    expect(screen.getByLabelText("Organization")).toHaveValue("Example Foundation");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("returns 404 for a program the user does not own", async () => {
    mocks.getOwnProgram.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
  });
});
