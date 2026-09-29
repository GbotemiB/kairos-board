import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgramGrid } from "@/components/programs/program-grid";
import type { Program } from "@/lib/programs/types";

const NOW = new Date("2026-09-24T12:00:00Z");

function makeProgram(id: string, title: string): Program {
  return {
    id,
    title,
    url: `https://example.org/${id}`,
    organization: null,
    type: "PROGRAM",
    status: "OPEN",
    deadlineType: "FIXED",
    opensAt: null,
    deadline: "2026-10-24",
    eligibility: [],
    location: null,
    field: null,
    funding: null,
  };
}

describe("ProgramGrid", () => {
  it("renders one list item per program, in order", () => {
    render(
      <ProgramGrid
        programs={[makeProgram("a", "Alpha"), makeProgram("b", "Beta"), makeProgram("c", "Gamma")]}
        now={NOW}
      />,
    );

    const list = screen.getByRole("list", { name: "Programs" });
    const articles = within(list).getAllByRole("article");
    expect(articles).toHaveLength(3);
    expect(articles.map((article) => within(article).getByRole("heading").textContent)).toEqual([
      "Alpha (opens in a new tab)",
      "Beta (opens in a new tab)",
      "Gamma (opens in a new tab)",
    ]);
  });

  it("passes the shared clock to each card", () => {
    render(<ProgramGrid programs={[makeProgram("a", "Alpha")]} now={NOW} />);

    expect(screen.getByText("Closes 24 Oct 2026")).toBeInTheDocument();
  });
});
