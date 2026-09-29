import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeleteProgramButton } from "@/components/my/delete-program-button";

describe("DeleteProgramButton", () => {
  it("asks for confirmation before deleting", async () => {
    const action = vi.fn(async () => ({}));
    render(<DeleteProgramButton title="Graduate Fellowship" action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete Graduate Fellowship" }));

    expect(screen.getByText("Delete this program?")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("deletes after confirming", async () => {
    const action = vi.fn(async () => ({}));
    render(<DeleteProgramButton title="Graduate Fellowship" action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete Graduate Fellowship" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("cancels without deleting", async () => {
    const action = vi.fn(async () => ({}));
    render(<DeleteProgramButton title="Graduate Fellowship" action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete Graduate Fellowship" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete Graduate Fellowship" })).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("shows an error from the action", async () => {
    render(
      <DeleteProgramButton
        title="Graduate Fellowship"
        action={async () => ({ error: "This program could not be found." })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete Graduate Fellowship" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This program could not be found.");
  });
});
