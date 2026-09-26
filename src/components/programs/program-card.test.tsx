import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MAX_ELIGIBILITY, ProgramCard } from "@/components/programs/program-card";
import type { Program } from "@/lib/programs/types";

const NOW = new Date("2026-09-24T12:00:00Z");

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: "a0000000-0000-0000-0000-000000000001",
    title: "Graduate Research Fellowship",
    url: "https://example.org/fellowship",
    organization: "Example Science Foundation",
    type: "FELLOWSHIP",
    status: "OPEN",
    deadlineType: "FIXED",
    opensAt: null,
    deadline: "2026-10-24",
    eligibility: ["Master's students", "STEM field"],
    location: "Remote",
    field: "Science",
    funding: "Monthly stipend",
    ...overrides,
  };
}

function renderCard(overrides: Partial<Program> = {}) {
  return render(<ProgramCard program={makeProgram(overrides)} now={NOW} />);
}

describe("ProgramCard", () => {
  it("is an article labelled by the program title", () => {
    renderCard();

    expect(
      screen.getByRole("article", { name: /Graduate Research Fellowship/ }),
    ).toBeInTheDocument();
  });

  it("links the title to the program page in a new tab with safe rel values", () => {
    renderCard();

    const link = screen.getByRole("link", { name: /Graduate Research Fellowship/ });
    expect(link).toHaveAttribute("href", "https://example.org/fellowship");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
    expect(within(link).getByText("(opens in a new tab)")).toHaveClass("sr-only");
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "not a url"])(
    "does not render a link for the unsafe URL %j",
    (url) => {
      renderCard({ url });

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Graduate Research Fellowship" }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    ["OPEN", "Open"],
    ["UPCOMING", "Upcoming"],
    ["CLOSED", "Closed"],
  ] as const)("shows the %s status badge", (status, label) => {
    renderCard({ status });

    expect(screen.getByText(label, { selector: "[data-slot=badge]" })).toBeInTheDocument();
  });

  it("shows the program type badge", () => {
    renderCard({ type: "INTERNSHIP" });

    expect(screen.getByText("Internship", { selector: "[data-slot=badge]" })).toBeInTheDocument();
  });

  it("shows the organization when present", () => {
    renderCard();

    expect(screen.getByText("Example Science Foundation")).toBeInTheDocument();
  });

  it("omits the organization when missing", () => {
    renderCard({ organization: null });

    expect(screen.queryByText("Example Science Foundation")).not.toBeInTheDocument();
  });

  it("renders a dated deadline inside a time element", () => {
    renderCard({ deadline: "2026-10-24" });

    const time = screen.getByText("Closes 24 Oct 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-10-24");
  });

  it("highlights an urgent deadline", () => {
    renderCard({ deadline: "2026-09-29" });

    expect(screen.getByText("Closes in 5 days").closest("p")).toHaveClass("text-red-700");
  });

  it("renders a rolling deadline without a time element", () => {
    renderCard({ deadline: null, deadlineType: "ROLLING" });

    const label = screen.getByText("Rolling deadline");
    expect(label.tagName).toBe("P");
    expect(document.querySelector("time")).toBeNull();
  });

  it("lists location, field and funding with accessible labels", () => {
    renderCard();

    for (const [label, value] of [
      ["Location", "Remote"],
      ["Field", "Science"],
      ["Funding", "Monthly stipend"],
    ]) {
      expect(screen.getByText(label)).toHaveClass("sr-only");
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it("skips empty or whitespace-only details", () => {
    renderCard({ location: "  ", field: null, funding: "Paid" });

    expect(screen.queryByText("Location")).not.toBeInTheDocument();
    expect(screen.queryByText("Field")).not.toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("renders no details list when all details are missing", () => {
    renderCard({ location: null, field: null, funding: null });

    expect(document.querySelector("dl")).toBeNull();
  });

  it(`shows at most ${MAX_ELIGIBILITY} eligibility items and counts the rest`, () => {
    renderCard({ eligibility: ["One", "Two", "Three", "Four", "Five"] });

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["One", "Two", "Three"]);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("does not show a remainder when all eligibility items fit", () => {
    renderCard({ eligibility: ["One", "Two", "Three"] });

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it("omits the eligibility section when there are no criteria", () => {
    renderCard({ eligibility: [] });

    expect(screen.queryByText("Eligibility")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
