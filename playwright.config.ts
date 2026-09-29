import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const MOCK_GEMINI_PORT = 4010;

/**
 * End-to-end tests against a production build and local Supabase
 * (`npm run db:start` first). Gemini is replaced by e2e/mock-gemini.mjs via
 * the SDK's GOOGLE_GEMINI_BASE_URL, so tests never use the real API or quota.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/mock-gemini.mjs",
      url: `http://127.0.0.1:${MOCK_GEMINI_PORT}/__health`,
      env: { MOCK_GEMINI_PORT: String(MOCK_GEMINI_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 240_000,
      // Always start fresh so the Gemini override below is guaranteed to apply.
      reuseExistingServer: false,
      env: {
        // Runtime env wins over .env.local, so the real key is never used here.
        GEMINI_API_KEY: "e2e-fake-key",
        GOOGLE_GEMINI_BASE_URL: `http://127.0.0.1:${MOCK_GEMINI_PORT}`,
        GEMINI_MODEL: "gemini-2.5-flash",
        GEMINI_FALLBACK_MODEL: "gemini-2.5-flash",
      },
    },
  ],
});
