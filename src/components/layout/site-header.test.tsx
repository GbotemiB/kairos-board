import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));

import { SiteHeader } from "@/components/layout/site-header";
import { siteConfig } from "@/lib/site";

describe("SiteHeader", () => {
  it("links the site name to the home page", () => {
    render(<SiteHeader user={null} />);

    expect(screen.getByRole("link", { name: siteConfig.name })).toHaveAttribute("href", "/");
  });

  it("renders a labelled main navigation with Board and GitHub links", () => {
    render(<SiteHeader user={null} />);

    const nav = within(screen.getByRole("navigation", { name: "Main" }));
    expect(nav.getByRole("link", { name: "Board" })).toHaveAttribute("href", "/");
    expect(nav.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", siteConfig.repoUrl);
  });

  it("opens the GitHub link in a new tab safely", () => {
    render(<SiteHeader user={null} />);

    const github = screen.getByRole("link", { name: "GitHub" });
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows a sign-in link when signed out", () => {
    render(<SiteHeader user={null} />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("shows the email and a sign-out button when signed in", () => {
    render(<SiteHeader user={{ id: "user-1", email: "me@example.org" }} />);

    expect(screen.getByText("me@example.org")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it.each([
    ["signed out", null],
    ["signed in", { id: "user-1", email: "me@example.org" }],
  ])("links to the submit page when %s", (_name, user) => {
    render(<SiteHeader user={user} />);

    expect(screen.getByRole("link", { name: "Add program" })).toHaveAttribute("href", "/submit");
  });
});
