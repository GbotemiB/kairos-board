import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoardResult } from "@/lib/programs/queries";
import type { Program } from "@/lib/programs/types";
import { siteConfig } from "@/lib/site";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(() => Promise.resolve()),
  getBoardPrograms: vi.fn<() => Promise<BoardResult>>(),
  createPublicClient: vi.fn(() => ({})),
}));

vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("@/lib/programs/queries", () => ({ getBoardPrograms: mocks.getBoardPrograms }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: mocks.createPublicClient }));

import Home from "@/app/page";

function makeProgram(id: string, title: string): Program {
  return {
    id,
    title,
    url: `https://example.org/${id}`,
    organization: null,
    type: "FELLOWSHIP",
    status: "OPEN",
    deadlineType: "ROLLING",
    opensAt: null,
    deadline: null,
    eligibility: [],
    location: null,
    field: null,
    funding: null,
  };
}

async function renderHome() {
  render(await Home());
}

describe("Home page (board)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders per request before loading data", async () => {
    mocks.getBoardPrograms.mockResolvedValue({ ok: true, programs: [] });

    await renderHome();

    expect(mocks.connection).toHaveBeenCalledTimes(1);
    expect(mocks.getBoardPrograms).toHaveBeenCalledTimes(1);
  });

  it("renders the tagline as the main heading", async () => {
    mocks.getBoardPrograms.mockResolvedValue({ ok: true, programs: [] });

    await renderHome();

    expect(screen.getByRole("heading", { level: 1, name: siteConfig.tagline })).toBeInTheDocument();
  });

  it("renders a card for each program with a count", async () => {
    mocks.getBoardPrograms.mockResolvedValue({
      ok: true,
      programs: [makeProgram("a", "Alpha"), makeProgram("b", "Beta")],
    });

    await renderHome();

    expect(screen.getByRole("heading", { name: "2 programs" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("uses the singular for one program", async () => {
    mocks.getBoardPrograms.mockResolvedValue({ ok: true, programs: [makeProgram("a", "Alpha")] });

    await renderHome();

    expect(screen.getByRole("heading", { name: "1 program" })).toBeInTheDocument();
  });

  it("shows the empty state when there are no programs", async () => {
    mocks.getBoardPrograms.mockResolvedValue({ ok: true, programs: [] });

    await renderHome();

    expect(screen.getByRole("region", { name: "No programs yet" })).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("shows the error state when loading fails", async () => {
    mocks.getBoardPrograms.mockResolvedValue({ ok: false });

    await renderHome();

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load the board");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
