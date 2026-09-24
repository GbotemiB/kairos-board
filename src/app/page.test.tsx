import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

// Smoke test proving Vitest, jsdom, RTL, jest-dom matchers and the "@/" alias work.
// Replace with real assertions when the board lands in Phase 2.
describe("Home page", () => {
  it("renders the main heading", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("opens external links in a new tab safely", () => {
    render(<Home />);

    const external = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("target") === "_blank");

    expect(external.length).toBeGreaterThan(0);
    for (const link of external) {
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }
  });
});
