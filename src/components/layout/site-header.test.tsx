import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/layout/site-header";
import { siteConfig } from "@/lib/site";

describe("SiteHeader", () => {
  it("links the site name to the home page", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: siteConfig.name })).toHaveAttribute("href", "/");
  });

  it("renders a labelled main navigation with Board and GitHub links", () => {
    render(<SiteHeader />);

    const nav = within(screen.getByRole("navigation", { name: "Main" }));
    expect(nav.getByRole("link", { name: "Board" })).toHaveAttribute("href", "/");
    expect(nav.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", siteConfig.repoUrl);
  });

  it("opens the GitHub link in a new tab safely", () => {
    render(<SiteHeader />);

    const github = screen.getByRole("link", { name: "GitHub" });
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", "noopener noreferrer");
  });
});
