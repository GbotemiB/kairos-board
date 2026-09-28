import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SaveProgramState } from "@/app/submit/actions";
import { ProgramForm } from "@/components/submit/program-form";
import { EMPTY_FORM_VALUES, type ProgramFormValues } from "@/lib/programs/form";

const VALUES: ProgramFormValues = {
  ...EMPTY_FORM_VALUES,
  url: "https://example.org/fellowship",
  title: "Graduate Fellowship",
  type: "FELLOWSHIP",
  deadline: "2026-11-15",
  deadlineType: "FIXED",
  eligibility: "Master's students\nEU citizens",
  applicationsClosed: true,
};

type SaveAction = (state: SaveProgramState, formData: FormData) => Promise<SaveProgramState>;

function renderForm(action = vi.fn<SaveAction>(async () => ({})), initialValues = VALUES) {
  render(<ProgramForm initialValues={initialValues} action={action} />);
  return action;
}

describe("ProgramForm", () => {
  it("pre-fills every field from the initial values", () => {
    renderForm();

    expect(screen.getByLabelText("Link")).toHaveValue("https://example.org/fellowship");
    expect(screen.getByLabelText("Program name")).toHaveValue("Graduate Fellowship");
    expect(screen.getByLabelText("Type")).toHaveValue("FELLOWSHIP");
    expect(screen.getByLabelText("Deadline")).toHaveValue("FIXED");
    expect(screen.getByLabelText("Applications close")).toHaveValue("2026-11-15");
    expect(screen.getByLabelText("Eligibility")).toHaveValue("Master's students\nEU citizens");
    expect(screen.getByLabelText("Applications are closed")).toBeChecked();
  });

  it("submits the edited values", async () => {
    const action = renderForm();

    await userEvent.clear(screen.getByLabelText("Program name"));
    await userEvent.type(screen.getByLabelText("Program name"), "Edited Fellowship");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "INTERNSHIP");
    await userEvent.click(screen.getByRole("button", { name: "Add to board" }));

    const formData = action.mock.calls[0][1];
    expect(formData.get("title")).toBe("Edited Fellowship");
    expect(formData.get("type")).toBe("INTERNSHIP");
    expect(formData.get("applicationsClosed")).toBe("on");
  });

  it("shows field errors linked to their inputs and keeps the submitted values", async () => {
    renderForm(
      vi.fn(async () => ({
        fieldErrors: { title: "Add the program name." },
        values: { ...VALUES, title: "", organization: "Kept Org" },
        attempt: 1,
      })),
    );

    await userEvent.click(screen.getByRole("button", { name: "Add to board" }));

    const title = await screen.findByLabelText("Program name");
    expect(screen.getByText("Add the program name.")).toHaveAttribute("id", "title-error");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAttribute("aria-describedby", "title-error");
    expect(screen.getByLabelText("Organization")).toHaveValue("Kept Org");
  });

  it("shows a form-level error", async () => {
    renderForm(
      vi.fn(async () => ({
        error: "Couldn't save the program. Please try again.",
        values: VALUES,
        attempt: 1,
      })),
    );

    await userEvent.click(screen.getByRole("button", { name: "Add to board" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the program.");
  });

  it("explains the eligibility format", () => {
    renderForm();

    expect(screen.getByLabelText("Eligibility")).toHaveAccessibleDescription(
      "One criterion per line.",
    );
  });
});
