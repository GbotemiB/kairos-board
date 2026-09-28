import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtractApiResponse } from "@/lib/extract/http";

const mocks = vi.hoisted(() => ({
  requestExtraction:
    vi.fn<(input: { url: string; text?: string }) => Promise<ExtractApiResponse>>(),
  push: vi.fn(),
}));

vi.mock("@/lib/extract/client", () => ({ requestExtraction: mocks.requestExtraction }));
vi.mock("@/app/submit/actions", () => ({ createProgram: vi.fn(async () => ({})) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

import { SubmitFlow } from "@/components/submit/submit-flow";

const DATA = {
  title: "Graduate Fellowship",
  organization: "Example Foundation",
  type: "FELLOWSHIP",
  opensAt: null,
  deadline: "2026-11-15",
  deadlineType: "FIXED",
  eligibility: ["Master's students"],
  location: null,
  field: null,
  funding: null,
  applicationsClosed: false,
  openToMasters: "YES",
} as const;

async function submitLink(url = "https://example.org/fellowship") {
  render(<SubmitFlow />);
  await userEvent.type(screen.getByLabelText("Link to the program"), url);
  await userEvent.click(screen.getByRole("button", { name: "Get details" }));
}

describe("SubmitFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts the link and shows the pre-filled review form with warnings", async () => {
    mocks.requestExtraction.mockResolvedValue({
      ok: true,
      url: "https://example.org/fellowship",
      normalizedUrl: "https://example.org/fellowship",
      data: { ...DATA, eligibility: [...DATA.eligibility] },
      warnings: ["No deadline found. Check the official page."],
    });

    await submitLink();

    expect(mocks.requestExtraction).toHaveBeenCalledWith({ url: "https://example.org/fellowship" });
    expect(await screen.findByLabelText("Program name")).toHaveValue("Graduate Fellowship");
    expect(screen.getByText("No deadline found. Check the official page.")).toBeInTheDocument();
  });

  it("shows a loading message while extracting", async () => {
    mocks.requestExtraction.mockReturnValue(new Promise(() => {}));

    await submitLink();

    expect(screen.getByRole("status")).toHaveTextContent("Reading the page…");
  });

  it("shows an invalid link error inline and keeps the input", async () => {
    mocks.requestExtraction.mockResolvedValue({
      ok: false,
      code: "INVALID_URL",
      message: "Only http:// and https:// links are supported.",
    });

    await submitLink("ftp://example.org");

    const input = await screen.findByLabelText("Link to the program");
    expect(input).toHaveValue("ftp://example.org");
    expect(input).toHaveAccessibleDescription("Only http:// and https:// links are supported.");
  });

  it("points to the existing program for duplicates", async () => {
    mocks.requestExtraction.mockResolvedValue({
      ok: false,
      code: "DUPLICATE",
      message: "This program is already on the board.",
      existing: { id: "p1", title: "Graduate Fellowship" },
    });

    await submitLink();

    expect(await screen.findByText("Graduate Fellowship")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View the board" })).toHaveAttribute("href", "/");
  });

  it.each(["THIN_CONTENT", "FETCH_FAILED", "UNSUPPORTED_CONTENT"] as const)(
    "offers paste-text mode after %s and sends the pasted text",
    async (code) => {
      mocks.requestExtraction.mockResolvedValueOnce({
        ok: false,
        code,
        message: "Paste its text instead.",
      });
      mocks.requestExtraction.mockResolvedValueOnce({
        ok: true,
        url: "https://example.org/fellowship",
        normalizedUrl: "https://example.org/fellowship",
        data: { ...DATA, eligibility: [] },
        warnings: [],
      });

      await submitLink();
      expect(await screen.findByRole("alert")).toHaveTextContent("Paste its text instead.");
      expect(screen.getByLabelText("Link")).toHaveValue("https://example.org/fellowship");

      await userEvent.type(screen.getByLabelText("Page text"), "The whole page text");
      await userEvent.click(screen.getByRole("button", { name: "Get details from text" }));

      expect(mocks.requestExtraction).toHaveBeenLastCalledWith({
        url: "https://example.org/fellowship",
        text: "The whole page text",
      });
      expect(await screen.findByLabelText("Program name")).toHaveValue("Graduate Fellowship");
    },
  );

  it.each(["AI_BUSY", "AI_FAILED", "RATE_LIMITED"] as const)(
    "falls back to the review form with a notice after %s",
    async (code) => {
      mocks.requestExtraction.mockResolvedValue({
        ok: false,
        code,
        message: `Notice for ${code}`,
        ...(code === "RATE_LIMITED"
          ? {}
          : { partial: { ...DATA, title: "Partial Title", eligibility: [] } }),
      });

      await submitLink();

      expect(await screen.findByText(`Notice for ${code}`)).toBeInTheDocument();
      expect(screen.getByLabelText("Link")).toHaveValue("https://example.org/fellowship");
      expect(screen.getByLabelText("Program name")).toHaveValue(
        code === "RATE_LIMITED" ? "" : "Partial Title",
      );
    },
  );

  it("sends signed-out users to login and back", async () => {
    mocks.requestExtraction.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Sign in",
    });

    await submitLink();

    expect(mocks.push).toHaveBeenCalledWith("/login?next=%2Fsubmit");
  });

  it("lets the user fill in the details manually", async () => {
    render(<SubmitFlow />);
    await userEvent.type(screen.getByLabelText("Link to the program"), "https://example.org/x");
    await userEvent.click(screen.getByRole("button", { name: "Fill in manually" }));

    expect(screen.getByLabelText("Link")).toHaveValue("https://example.org/x");
    expect(screen.getByLabelText("Program name")).toHaveValue("");
    expect(mocks.requestExtraction).not.toHaveBeenCalled();
  });

  it("lets the user paste text without trying the link first", async () => {
    render(<SubmitFlow />);
    await userEvent.click(screen.getByRole("button", { name: "Paste page text instead" }));

    expect(screen.getByLabelText("Page text")).toBeInTheDocument();
  });

  it("starts over from the review form", async () => {
    render(<SubmitFlow />);
    await userEvent.click(screen.getByRole("button", { name: "Fill in manually" }));
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.getByLabelText("Link to the program")).toBeInTheDocument();
  });
});
