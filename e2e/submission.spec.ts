import { expect, test } from "@playwright/test";

import { PAGE_TEXT, mockGeminiRequests, resetMockGemini, signUp, uniqueStamp } from "./helpers";

test.beforeEach(async () => {
  await resetMockGemini();
});

test("full flow: sign up, extract from pasted text, review, submit, duplicate, edit, delete", async ({
  page,
}) => {
  const stamp = uniqueStamp();
  const url = `https://example.org/e2e/robotics-${stamp}`;
  const title = `Robotics Summer School E2E ${stamp}`;

  // Signed out: the submit page sends you to log in and remembers where you were going.
  await page.goto("/");
  await page.getByRole("link", { name: "Add program" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fsubmit$/);

  // Create an account from the login page; the return path is kept.
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup\?next=%2Fsubmit$/);
  await page.getByLabel("Email").fill(`e2e-${stamp}@kairos.local`);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/submit$/);
  await expect(page.getByRole("heading", { level: 1, name: "Add a program" })).toBeVisible();

  // Paste-text extraction goes through the real route, rate limiter and Gemini client (mocked API).
  await page.getByRole("button", { name: "Paste page text instead" }).click();
  await page.getByLabel("Link").fill(url);
  await page.getByLabel("Page text").fill(PAGE_TEXT);
  await page.getByRole("button", { name: "Get details from text" }).click();

  // The review form is pre-filled with the AI result.
  await expect(page.getByLabel("Program name")).toHaveValue("Robotics Summer School 2027");
  await expect(page.getByLabel("Organization")).toHaveValue("Example Tech University");
  await expect(page.getByLabel("Type")).toHaveValue("PROGRAM");
  await expect(page.getByLabel("Applications close")).toHaveValue("2027-03-01");
  await expect(page.getByLabel("Eligibility")).toHaveValue(
    "Master's students in robotics or mechanical engineering",
  );

  const requests = await mockGeminiRequests();
  expect(requests).toHaveLength(1);
  expect(requests[0].prompt).toContain("Applications close on 1 March 2027");
  expect(requests[0].prompt).toContain(`Source URL: ${url}`);

  // The user corrects the title, then submits.
  await page.getByLabel("Program name").fill(title);
  await page.getByRole("button", { name: "Add to board" }).click();

  await expect(page).toHaveURL(/\/\?added=1$/);
  await expect(page.getByText("Thanks! Your program is now on the board.")).toBeVisible();
  const card = page.getByRole("article", { name: title });
  await expect(card).toBeVisible();
  // Deadline 2027-03-01 and no opening date: always OPEN.
  await expect(card.getByText("Open", { exact: true })).toBeVisible();
  await expect(card.getByText("Delft, Netherlands")).toBeVisible();

  // Submitting the same link again is caught before any AI call.
  await page.getByRole("link", { name: "Add program" }).click();
  await page.getByRole("button", { name: "Paste page text instead" }).click();
  await page.getByLabel("Link").fill(`${url}?utm_source=e2e`);
  await page.getByLabel("Page text").fill(PAGE_TEXT);
  await page.getByRole("button", { name: "Get details from text" }).click();
  await expect(page.getByText("is already on the board.")).toBeVisible();
  expect(await mockGeminiRequests()).toHaveLength(1);

  // Edit it from My submissions.
  await page.getByRole("link", { name: "My submissions" }).click();
  await expect(page).toHaveURL(/\/my$/);
  await page.getByRole("link", { name: `Edit ${title}` }).click();
  await expect(page.getByLabel("Program name")).toHaveValue(title);
  await page.getByLabel("Funding").fill("Fully funded");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/my\?updated=1$/);
  await expect(page.getByText("Your changes are saved.")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("article", { name: title }).getByText("Fully funded")).toBeVisible();

  // Delete it, with confirmation.
  await page.goto("/my");
  await page.getByRole("button", { name: `Delete ${title}` }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page).toHaveURL(/\/my\?deleted=1$/);
  await expect(page.getByText("The program was deleted.")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByRole("article", { name: title })).toHaveCount(0);

  // Sign out.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("manual entry shows validation errors, keeps input, and saves once fixed", async ({
  page,
}) => {
  const stamp = uniqueStamp();
  const url = `https://example.org/e2e/manual-${stamp}`;
  const title = `Manual Fellowship E2E ${stamp}`;

  await signUp(page, "/submit");
  await expect(page).toHaveURL(/\/submit$/);

  await page.getByLabel("Link to the program").fill(url);
  await page.getByRole("button", { name: "Fill in manually" }).click();
  await page.getByLabel("Organization").fill("Kept Organization");
  await page.getByRole("button", { name: "Add to board" }).click();

  // Server-side validation; the other fields keep their values.
  await expect(page.getByText("Add the program name.")).toBeVisible();
  await expect(page.getByLabel("Program name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Organization")).toHaveValue("Kept Organization");

  await page.getByLabel("Program name").fill(title);
  await page.getByLabel("Type").selectOption("FELLOWSHIP");
  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page.getByRole("article", { name: title })).toBeVisible();
  expect(await mockGeminiRequests()).toHaveLength(0);

  // Clean up.
  await page.goto("/my");
  await page.getByRole("button", { name: `Delete ${title}` }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByText("The program was deleted.")).toBeVisible();
});

test("rejects an invalid link inline without calling the AI", async ({ page }) => {
  await signUp(page, "/submit");

  await page.getByLabel("Link to the program").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Get details" }).click();

  await expect(page.getByText("Only http:// and https:// links are supported.")).toBeVisible();
  await expect(page.getByLabel("Link to the program")).toHaveValue("javascript:alert(1)");
  expect(await mockGeminiRequests()).toHaveLength(0);
});
