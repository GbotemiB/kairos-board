import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";
import { siteConfig } from "@/lib/site";

// Placeholder page test. Replaced when the board lands (Phase 2, step 4).
describe("Home page", () => {
  it("renders the tagline as the main heading", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: siteConfig.tagline })).toBeInTheDocument();
  });

  it("renders the site description", () => {
    render(<Home />);

    expect(screen.getByText(siteConfig.description)).toBeInTheDocument();
  });
});
