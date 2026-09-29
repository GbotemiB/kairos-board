import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_FILTERS } from "@/lib/programs/filters";
import type { BoardResult } from "@/lib/programs/queries";
import type { Program } from "@/lib/programs/types";
import { siteConfig } from "@/lib/site";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(() => Promise.resolve()),
  getBoardPrograms: vi.fn<(client: unknown, filters: unknown) => Promise<BoardResult>>(),
  createPublicClient: vi.fn(() => ({ tag: "public" })),
}));

vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/programs/queries", () => ({ getBoardPrograms: mocks.getBoardPrograms }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: mocks.createPublicClient }));

import Home from "@/app/(board)/page";

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
    location: "Remote",
    field: null,
    funding: null,
  };
}

function page(
  programs: Program[],
  total = programs.length,
  pageNumber = 1,
  pageCount = 1,
): BoardResult {
  return { ok: true, programs, total, page: pageNumber, pageCount };
}

async function renderHome(searchParams: Record<string, string | string[]> = {}) {
  render(await Home({ params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) }));
}

describe("Home page (board)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders per request and loads the board with the default filters", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([]));

    await renderHome();

    expect(mocks.connection).toHaveBeenCalledTimes(1);
    expect(mocks.getBoardPrograms).toHaveBeenCalledWith({ tag: "public" }, DEFAULT_FILTERS);
  });

  it("passes filters from the URL to the query", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([]));

    await renderHome({
      status: "closed",
      type: ["INTERNSHIP"],
      q: "ai",
      sort: "newest",
      view: "list",
      page: "2",
    });

    expect(mocks.getBoardPrograms).toHaveBeenCalledWith(expect.anything(), {
      status: "closed",
      types: ["INTERNSHIP"],
      q: "ai",
      sort: "newest",
      view: "list",
      page: 2,
    });
  });

  it("renders the tagline, the filters and the view toggle", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([makeProgram("a", "Alpha")]));

    await renderHome();

    expect(screen.getByRole("heading", { level: 1, name: siteConfig.tagline })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Filter programs" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "View" })).toBeInTheDocument();
  });

  it("shows cards by default with the total count", async () => {
    mocks.getBoardPrograms.mockResolvedValue(
      page([makeProgram("a", "Alpha"), makeProgram("b", "Beta")], 30, 1, 2),
    );

    await renderHome();

    expect(screen.getByRole("heading", { name: "30 programs" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
  });

  it("shows the list view when asked", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([makeProgram("a", "Alpha")]));

    await renderHome({ view: "list" });

    expect(screen.getByRole("table", { name: "Programs" })).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("uses the singular for one program", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([makeProgram("a", "Alpha")]));

    await renderHome();

    expect(screen.getByRole("heading", { name: "1 program" })).toBeInTheDocument();
  });

  it("offers Clear filters only when filters are active, keeping the view", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([makeProgram("a", "Alpha")]));

    await renderHome({ q: "alpha", view: "list" });
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/?view=list",
    );
  });

  it("hides Clear filters for the default view", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([makeProgram("a", "Alpha")]));

    await renderHome();
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("suggests showing closed programs when the default view is empty", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([]));

    await renderHome();

    expect(screen.getByRole("link", { name: "Show closed programs too" })).toHaveAttribute(
      "href",
      "/?status=all",
    );
  });

  it("offers to clear filters when filters match nothing", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([]));

    await renderHome({ type: "OTHER" });

    expect(
      screen.getByRole("region", { name: "No programs match these filters" }),
    ).toBeInTheDocument();
  });

  it("links back to the first page when past the last page", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([], 5, 9, 1));

    await renderHome({ page: "9" });

    expect(screen.getByRole("link", { name: "Go to the first page" })).toHaveAttribute("href", "/");
  });

  it("thanks the user after adding a program", async () => {
    mocks.getBoardPrograms.mockResolvedValue(page([]));

    await renderHome({ added: "1" });

    expect(screen.getByText("Thanks! Your program is now on the board.")).toBeInTheDocument();
  });

  it("shows the error state when loading fails", async () => {
    mocks.getBoardPrograms.mockResolvedValue({ ok: false });

    await renderHome();

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load the board");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
