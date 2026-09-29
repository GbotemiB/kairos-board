import { expect, type Page } from "@playwright/test";

export const MOCK_GEMINI = "http://127.0.0.1:4010";

export const PAGE_TEXT = `Robotics Summer School 2027
Hosted by Example Tech University in Delft, Netherlands.
Open to master's students in robotics or mechanical engineering.
Applications close on 1 March 2027. Tuition is free and a 500 EUR travel grant is available.
The program runs for two weeks in July with lectures, lab sessions and a final project.
Participants work in small teams on real robots and present their results to industry partners.`;

export function uniqueStamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Signs up a fresh user through the UI (local Supabase has email confirmation off). */
export async function signUp(page: Page, next = "/"): Promise<string> {
  const email = `e2e-${uniqueStamp()}@kairos.local`;
  await page.goto(`/signup${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  return email;
}

export async function resetMockGemini(): Promise<void> {
  await fetch(`${MOCK_GEMINI}/__reset`, { method: "POST" });
}

export async function mockGeminiRequests(): Promise<Array<{ url: string; prompt: string }>> {
  return (await fetch(`${MOCK_GEMINI}/__requests`)).json();
}
