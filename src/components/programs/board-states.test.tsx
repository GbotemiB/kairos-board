import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardEmptyState, BoardErrorState } from "@/components/programs/board-states";

describe("BoardEmptyState", () => {
  it("invites the first submission when the board is empty", () => {
    render(<BoardEmptyState />);

    expect(screen.getByRole("region", { name: "No open programs right now" })).toHaveTextContent(
      "Be the first to share an opportunity.",
    );
  });

  it("offers to show closed programs when only the default view is empty", () => {
    render(<BoardEmptyState showAllHref="/?status=all" />);

    expect(screen.getByRole("link", { name: "Show closed programs too" })).toHaveAttribute(
      "href",
      "/?status=all",
    );
  });

  it("offers to clear filters when filters hide everything", () => {
    render(<BoardEmptyState clearHref="/?view=list" />);

    expect(
      screen.getByRole("region", { name: "No programs match these filters" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/?view=list",
    );
  });
});

describe("BoardErrorState", () => {
  it("is announced as an alert", () => {
    render(<BoardErrorState />);

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load the board");
  });

  it("offers a link to try again", () => {
    render(<BoardErrorState />);

    expect(screen.getByRole("link", { name: "try again" })).toHaveAttribute("href", "/");
  });
});
