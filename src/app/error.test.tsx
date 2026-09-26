import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/error";

describe("Error boundary page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an alert and logs the error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");

    render(<ErrorPage error={error} retry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it("calls retry when the button is clicked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();

    render(<ErrorPage error={new Error("boom")} retry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
