import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import { siteConfig } from "@/lib/site";

describe("SiteFooter", () => {
  it("states the license", () => {
    render(<SiteFooter />);

    expect(screen.getByText(/MIT License/)).toBeInTheDocument();
  });

  it("tells users to confirm details on the official page", () => {
    render(<SiteFooter />);

    expect(screen.getByText(/confirm on the official page/)).toBeInTheDocument();
  });

  it("links to the repository in a new tab safely", () => {
    render(<SiteFooter />);

    const link = screen.getByRole("link", { name: "Contribute on GitHub" });
    expect(link).toHaveAttribute("href", siteConfig.repoUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
