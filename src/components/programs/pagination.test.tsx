import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Pagination } from "@/components/programs/pagination";
import { DEFAULT_FILTERS } from "@/lib/programs/filters";

const filters = { ...DEFAULT_FILTERS, q: "ai" };

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination filters={filters} page={1} pageCount={1} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows only Next on the first page", () => {
    render(<Pagination filters={filters} page={1} pageCount={3} />);

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/?q=ai&page=2");
  });

  it("shows both links in the middle, keeping filters", () => {
    render(<Pagination filters={filters} page={2} pageCount={3} />);

    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/?q=ai");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/?q=ai&page=3");
  });

  it("shows only Previous on the last page", () => {
    render(<Pagination filters={filters} page={3} pageCount={3} />);

    expect(screen.getByRole("link", { name: "Previous" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
  });

  it("clamps the page label when past the end", () => {
    render(<Pagination filters={filters} page={9} pageCount={3} />);

    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
  });
});
