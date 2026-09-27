import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";
import type { AuthFormState } from "@/lib/auth/schema";

function renderForm(
  mode: "signin" | "signup",
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState> = vi.fn(
    async () => ({}),
  ),
  next = "/",
) {
  render(<AuthForm mode={mode} action={action} next={next} />);
  return action;
}

describe("AuthForm", () => {
  it("renders the sign-in form with a link to sign up", () => {
    renderForm("signin");

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("renders the sign-up form with a link to sign in", () => {
    renderForm("signup");

    expect(screen.getByRole("heading", { name: "Create an account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("carries the next path through the form and the switch link", () => {
    renderForm("signin", undefined, "/submit");

    expect(document.querySelector('input[name="next"]')).toHaveValue("/submit");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup?next=%2Fsubmit",
    );
  });

  it("submits the entered credentials to the action", async () => {
    const action = renderForm("signin");

    await userEvent.type(screen.getByLabelText("Email"), "me@example.org");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const formData = vi.mocked(action).mock.calls[0][1];
    expect(formData.get("email")).toBe("me@example.org");
    expect(formData.get("password")).toBe("password123");
    expect(formData.get("next")).toBe("/");
  });

  it("shows a form-level error from the action", async () => {
    renderForm("signin", async () => ({
      error: "Incorrect email or password.",
      email: "me@example.org",
    }));

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(screen.getByLabelText("Email")).toHaveValue("me@example.org");
  });

  it("shows field errors linked to their inputs", async () => {
    renderForm("signup", async () => ({
      fieldErrors: {
        email: "Enter a valid email address.",
        password: "Use at least 8 characters.",
      },
    }));

    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    const email = screen.getByLabelText("Email");
    expect(await screen.findByText("Enter a valid email address.")).toHaveAttribute(
      "id",
      "email-error",
    );
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "email-error");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-describedby", "password-error");
  });

  it("shows a status message, e.g. check your email", async () => {
    renderForm("signup", async () => ({
      message: "Check your email for a confirmation link to finish signing up.",
    }));

    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
  });

  it("shows a notice passed by the page", () => {
    render(
      <AuthForm mode="signin" action={vi.fn(async () => ({}))} next="/" notice="Link expired." />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Link expired.");
  });
});
