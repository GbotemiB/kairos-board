import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgramList } from "@/components/programs/program-list";
import type { Program } from "@/lib/programs/types";

const NOW = new Date("2026-09-24T12:00:00Z");

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: "a",
    title: "Graduate Fellowship",
    url: "https://example.org/fellowship",
    organization: "Example Foundation",
    type: "FELLOWSHIP",
    status: "OPEN",
    deadlineType: "FIXED",
    opensAt: null,
    deadline: "2026-10-24",
    eligibility: [],
    location: "Lisbon, Portugal",
    field: null,
    funding: null,
    ...overrides,
  };
}

describe("ProgramList", () => {
  it("renders a table with column headers", () => {
    render(<ProgramList programs={[program()]} now={NOW} />);

    const table = screen.getByRole("table", { name: "Programs" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Program", "Type", "Status", "Deadline", "Location"]);
  });

  it("shows one row per program with its details", () => {
    render(<ProgramList programs={[program()]} now={NOW} />);

    const [, row] = screen.getAllByRole("row");
    expect(within(row).getByRole("rowheader")).toHaveTextContent("Graduate Fellowship");
    expect(row).toHaveTextContent("Example Foundation");
    expect(row).toHaveTextContent("Fellowship");
    expect(row).toHaveTextContent("Open");
    expect(within(row).getByText("Closes 24 Oct 2026").tagName).toBe("TIME");
    expect(row).toHaveTextContent("Lisbon, Portugal");
  });

  it("links titles safely in a new tab", () => {
    render(<ProgramList programs={[program()]} now={NOW} />);

    const link = screen.getByRole("link", { name: /Graduate Fellowship/ });
    expect(link).toHaveAttribute("href", "https://example.org/fellowship");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
  });

  it("does not link an unsafe URL", () => {
    render(<ProgramList programs={[program({ url: "javascript:alert(1)" })]} now={NOW} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a dash for a missing location and highlights urgent deadlines", () => {
    render(
      <ProgramList programs={[program({ location: null, deadline: "2026-09-29" })]} now={NOW} />,
    );

    const [, row] = screen.getAllByRole("row");
    expect(within(row).getAllByRole("cell").at(-1)).toHaveTextContent("-");
    expect(within(row).getByText("Closes in 5 days").closest("td")).toHaveClass("text-red-700");
  });
});
