import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ViewToggle } from "@/components/programs/view-toggle";
import { DEFAULT_FILTERS } from "@/lib/programs/filters";

describe("ViewToggle", () => {
  it("links to both views, keeping the other filters", () => {
    render(<ViewToggle filters={{ ...DEFAULT_FILTERS, q: "ai", page: 2 }} />);

    const nav = within(screen.getByRole("navigation", { name: "View" }));
    expect(nav.getByRole("link", { name: "Cards" })).toHaveAttribute("href", "/?q=ai&page=2");
    expect(nav.getByRole("link", { name: "List" })).toHaveAttribute(
      "href",
      "/?q=ai&view=list&page=2",
    );
  });

  it("marks the current view", () => {
    render(<ViewToggle filters={{ ...DEFAULT_FILTERS, view: "list" }} />);

    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Cards" })).not.toHaveAttribute("aria-current");
  });
});
