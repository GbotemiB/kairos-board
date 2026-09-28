import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { BoardFilters } from "@/components/programs/board-filters";
import { DEFAULT_FILTERS, type BoardFilters as Filters } from "@/lib/programs/filters";

function renderFilters(overrides: Partial<Filters> = {}) {
  render(<BoardFilters filters={{ ...DEFAULT_FILTERS, ...overrides }} />);
}

describe("BoardFilters", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("is a labelled search form that works without JavaScript", () => {
    renderFilters();

    const form = screen.getByRole("search", { name: "Filter programs" });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/");
  });

  it("shows the current filters", () => {
    renderFilters({ status: "closed", types: ["FELLOWSHIP"], q: "climate", sort: "newest" });

    expect(screen.getByLabelText("Search")).toHaveValue("climate");
    expect(screen.getByLabelText("Status")).toHaveValue("closed");
    expect(screen.getByLabelText("Fellowship")).toBeChecked();
    expect(screen.getByLabelText("Internship")).not.toBeChecked();
    expect(screen.getByLabelText("Sort")).toHaveValue("newest");
  });

  it("defaults to open and upcoming", () => {
    renderFilters();

    expect(screen.getByLabelText("Status")).toHaveValue("open-upcoming");
    expect(screen.getByRole("option", { name: "Open & upcoming" })).toBeInTheDocument();
  });

  it("applies a status change at once, back on page 1, without default params", async () => {
    renderFilters({ page: 3 });

    await userEvent.selectOptions(screen.getByLabelText("Status"), "all");

    expect(push).toHaveBeenCalledWith("/?status=all", { scroll: false });
  });

  it("applies type checkboxes at once", async () => {
    renderFilters();

    await userEvent.click(screen.getByLabelText("Internship"));
    await userEvent.click(screen.getByLabelText("Program"));

    expect(push).toHaveBeenLastCalledWith("/?type=INTERNSHIP&type=PROGRAM", { scroll: false });
  });

  it("applies the sort at once", async () => {
    renderFilters();

    await userEvent.selectOptions(screen.getByLabelText("Sort"), "newest");

    expect(push).toHaveBeenCalledWith("/?sort=newest", { scroll: false });
  });

  it("searches on Enter, not on every keystroke", async () => {
    renderFilters();

    await userEvent.type(screen.getByLabelText("Search"), "robotics");
    expect(push).not.toHaveBeenCalled();

    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/?q=robotics", { scroll: false });
  });

  it("keeps the list view when filtering", async () => {
    renderFilters({ view: "list" });

    await userEvent.selectOptions(screen.getByLabelText("Status"), "closed");

    expect(push).toHaveBeenCalledWith("/?status=closed&view=list", { scroll: false });
  });
});
