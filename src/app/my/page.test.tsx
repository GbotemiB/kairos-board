import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MySubmission } from "@/lib/programs/mine";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: null })),
  getMySubmissions: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn(async () => ({})) }));
vi.mock("@/lib/programs/mine", () => ({ getMySubmissions: mocks.getMySubmissions }));
vi.mock("@/app/my/actions", () => ({ deleteProgram: vi.fn() }));

import MySubmissionsPage from "@/app/my/page";

function program(overrides: Partial<MySubmission> = {}): MySubmission {
  return {
    id: "a0000000-0000-4000-8000-000000000001",
    title: "Graduate Fellowship",
    url: "https://example.org/fellowship",
    created_at: "2026-09-20T10:00:00Z",
    deadline: "2026-11-15",
    deadline_type: "FIXED",
    status_override: null,
    is_hidden: false,
    ...overrides,
  };
}

async function renderPage(searchParams: Record<string, string> = {}) {
  render(
    await MySubmissionsPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve(searchParams),
    }),
  );
}

describe("My submissions page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires sign-in and returns here afterwards", async () => {
    mocks.getMySubmissions.mockResolvedValue({ ok: true, programs: [] });

    await renderPage();

    expect(mocks.requireUser).toHaveBeenCalledWith("/my");
    expect(mocks.getMySubmissions).toHaveBeenCalledWith({}, "user-1");
  });

  it("lists the user's programs with edit and delete controls", async () => {
    mocks.getMySubmissions.mockResolvedValue({ ok: true, programs: [program()] });

    await renderPage();

    const item = within(screen.getByRole("list", { name: "Your programs" })).getByRole("listitem");
    expect(item).toHaveTextContent("Graduate Fellowship");
    expect(item).toHaveTextContent("Added 20 Sept 2026");
    expect(within(item).getByRole("link", { name: "Edit Graduate Fellowship" })).toHaveAttribute(
      "href",
      "/my/a0000000-0000-4000-8000-000000000001/edit",
    );
    expect(
      within(item).getByRole("button", { name: "Delete Graduate Fellowship" }),
    ).toBeInTheDocument();
  });

  it("flags programs hidden by a moderator", async () => {
    mocks.getMySubmissions.mockResolvedValue({
      ok: true,
      programs: [program({ is_hidden: true })],
    });

    await renderPage();

    expect(screen.getByText("Hidden by a moderator")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mocks.getMySubmissions.mockResolvedValue({ ok: true, programs: [] });

    await renderPage();

    expect(screen.getByText("You haven't added any programs yet.")).toBeInTheDocument();
  });

  it("shows an error when loading fails", async () => {
    mocks.getMySubmissions.mockResolvedValue({ ok: false });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load your submissions.");
  });

  it.each([
    [{ updated: "1" }, "Your changes are saved."],
    [{ deleted: "1" }, "The program was deleted."],
  ])("confirms the last action (%j)", async (searchParams, message) => {
    mocks.getMySubmissions.mockResolvedValue({ ok: true, programs: [] });

    await renderPage(searchParams);

    expect(screen.getByRole("status")).toHaveTextContent(message);
  });
});
