import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const requireUser = vi.hoisted(() => vi.fn(async () => ({ id: "user-1", email: null })));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/components/submit/submit-flow", () => ({ SubmitFlow: () => <div>submit flow</div> }));

import SubmitPage from "@/app/submit/page";

describe("Submit page", () => {
  it("requires a signed-in user and returns here after login", async () => {
    render(await SubmitPage());

    expect(requireUser).toHaveBeenCalledWith("/submit");
    expect(screen.getByRole("heading", { level: 1, name: "Add a program" })).toBeInTheDocument();
    expect(screen.getByText("submit flow")).toBeInTheDocument();
  });
});
