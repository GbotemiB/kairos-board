import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardEmptyState, BoardErrorState } from "@/components/programs/board-states";

describe("BoardEmptyState", () => {
  it("explains that there are no programs yet", () => {
    render(<BoardEmptyState />);

    expect(screen.getByRole("region", { name: "No programs yet" })).toBeInTheDocument();
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
