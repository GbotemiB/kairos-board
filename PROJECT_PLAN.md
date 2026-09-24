# Kairos: Open-Source AI Application Manager

> _Kairos (καιρός): the right, opportune moment._ Never miss the right moment to apply.

Repository: [GbotemiB/kairos-board](https://github.com/GbotemiB/kairos-board) · Live: [kairos-board.netlify.app](https://kairos-board.netlify.app) · License: MIT

## 🌟 1. Project Overview

Kairos is a collaborative, open-source platform designed for master's students to track internships, fellowships, and academic programs.

**Core Mechanics:**

- **Public Read, Authenticated Write:** Anyone can view the board of opportunities. To contribute a new link, users must create an account and log in. Users can only edit or delete their own submissions.
- **AI Automation:** Users paste a URL, and the system safely fetches the page, extracts the content, and uses the Google Gemini API to pull out key information (Deadline, Eligibility, Type) into a structured format. If a page cannot be scraped, users can paste the page text or fill the form manually.

---

## 🛠️ 2. Technology Stack

- **Framework:** [Next.js (App Router)](https://nextjs.org/) with React and TypeScript.
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL, GitHub/Google OAuth, Row Level Security). Schema managed via the **Supabase CLI** (local dev + migration files + generated TypeScript types).
- **Styling & UI:** [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + Lucide Icons.
- **AI Engine:** Google Gemini API via `@google/genai`, using structured output (`responseSchema`). Model name configured via env var.
- **Validation:** `zod` for AI output, API inputs, and form data.
- **Web Scraping:** `cheerio` for server-side HTML parsing, `undici` for a hardened fetch, `ipaddr.js` for IP range checks.
- **Testing:** `Vitest` + `React Testing Library` (unit/component/integration) and `Playwright` (end-to-end). Vitest chosen over Jest for simpler ESM/TypeScript setup with Next.js.
- **Hosting & CI:** GitHub (repo + Actions) and [Netlify](https://www.netlify.com/) (Next.js runtime, deploy previews on PRs). Node 22 LTS pinned via `.nvmrc`.

### Low-Management Hosting Model

- **Netlify:** auto-deploys `main`, builds a deploy preview for every PR.
- **Supabase migrations:** applied by a GitHub Action (`supabase db push`) on merge to `main`. No manual dashboard edits.
- **Supabase keep-alive:** free projects pause after ~1 week of inactivity. A scheduled GitHub Action pings the database every few days.
- **Secrets:** `GEMINI_API_KEY` and the Supabase service role key must not be exposed to deploy previews built from fork PRs.
- **OAuth:** add the Netlify production domain and deploy preview URLs to the Supabase Auth redirect allow-list.
- **Only ongoing task:** watching free-tier usage (Netlify, Supabase, Gemini).

---

## ⚙️ 3. Core Workflows

### A. The "Magic Link" Submission Flow

1. **Authentication:** User logs in via Supabase Auth.
2. **Input:** User pastes `https://example.com/fellowship` into the submission modal.
3. **URL Check:** The URL is validated, normalized, and checked for duplicates (see 3C). Duplicates return the existing program instead of re-extracting.
4. **Safe Fetch:** The server fetches the page with SSRF protections, a timeout, and a size limit (see 3C).
5. **Content Extraction:** Structured data (JSON-LD) is read first, then `cheerio` extracts the main text, stripping scripts, styles, navigation, and ads (see 3D).
6. **AI Extraction:** The cleaned text is sent to Gemini with a strict `responseSchema`. The response is validated with `zod`.
7. **Review:** The UI receives the JSON plus any warnings and presents it in a form. The user corrects any AI mistakes.
8. **Save:** The confirmed data is written to Supabase.

**Fallbacks:** If the page is JavaScript-rendered, blocked, or a PDF, the API returns a clear error code and the UI offers (a) pasting the page text for AI extraction, or (b) manual entry.

### B. Database Schema (Supabase)

**Enums**

- `program_type`: INTERNSHIP, FELLOWSHIP, PROGRAM, OTHER
- `program_status`: OPEN, CLOSED, UPCOMING
- `deadline_type`: FIXED, ROLLING, UNKNOWN

**Table: `programs`**

- `id` (uuid, primary key, default `gen_random_uuid()`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, updated via trigger)
- `submitter_id` (uuid, not null, foreign key to `auth.users`)
- `url` (text, not null): original URL as submitted
- `url_normalized` (text, not null, **unique**): used for duplicate detection
- `title` (text, not null)
- `organization` (text)
- `type` (`program_type`, not null)
- `opens_at` (date, nullable)
- `deadline` (date, nullable)
- `deadline_type` (`deadline_type`, default UNKNOWN)
- `eligibility` (text[], default `{}`)
- `location` (text, nullable)
- `field` (text, nullable)
- `funding` (text, nullable)
- `status_override` (`program_status`, nullable): only set when a user manually overrides, e.g. a program closed early
- `is_hidden` (boolean, default false): moderation flag

**Derived status (not stored):** Exposed via a view `programs_public`:

1. If `status_override` is set, use it.
2. Else if `opens_at > today`, UPCOMING.
3. Else if `deadline < today`, CLOSED.
4. Else OPEN (includes rolling deadlines).

**Deadline timezone:** Deadlines are stored as dates and displayed "as listed on the source site". The UI links to the source for exact time and timezone.

**Table: `reports`**

- `id` (uuid, primary key), `created_at` (timestamptz)
- `program_id` (uuid, foreign key to `programs`, on delete cascade)
- `reporter_id` (uuid, foreign key to `auth.users`)
- `reason` (text)
- Unique on (`program_id`, `reporter_id`)

**Table: `extraction_logs`** (used for rate limiting and debugging)

- `id` (uuid, primary key), `created_at` (timestamptz)
- `user_id` (uuid, foreign key to `auth.users`)
- `url_normalized` (text)
- `outcome` (text): SUCCESS or one of the error codes in 3E

_Row Level Security (RLS) Policies:_

- `programs`
  - `SELECT`: public, where `is_hidden = false`.
  - `INSERT`: authenticated, `WITH CHECK (submitter_id = auth.uid())`.
  - `UPDATE`: `USING (submitter_id = auth.uid()) WITH CHECK (submitter_id = auth.uid())`.
  - `DELETE`: `USING (submitter_id = auth.uid())`.
- `reports`
  - `INSERT`: authenticated, `WITH CHECK (reporter_id = auth.uid())`.
  - `SELECT`: none (reviewed by maintainers via dashboard/service role for now).
- `extraction_logs`
  - `INSERT` / `SELECT`: own rows only (`user_id = auth.uid()`).

### C. URL Checker

Lives in `lib/url/` and `lib/scrape/safe-fetch.ts`. Runs in this order, cheapest checks first:

1. **Parse & basic rules** (`validateUrl`)
   - Must parse with `new URL()`.
   - Scheme must be `http:` or `https:`.
   - No embedded credentials (`user:pass@`).
   - Port must be empty, 80, or 443.
   - Max length (e.g. 2048 chars).
2. **Normalize** (`normalizeUrl`)
   - Lowercase scheme and host, strip `www.`, drop fragment, drop default port.
   - Remove tracking params (`utm_*`, `fbclid`, `gclid`, `ref`), sort remaining params.
   - Remove trailing slash.
3. **Duplicate check**
   - Look up `url_normalized` in `programs`. If found, return `DUPLICATE` with the existing program ID. No scrape, no AI call.
4. **Rate limit**
   - Count the user's `extraction_logs` rows in the last hour. Reject with `RATE_LIMITED` above the limit (e.g. 10/hour).
5. **SSRF-safe fetch** (`safeFetch`)
   - Use an `undici` `Agent` with a custom DNS `lookup` that resolves the host and rejects any IP that is not public unicast (`ipaddr.js` `range() !== 'unicast'`). This blocks localhost, private ranges, link-local/cloud metadata (`169.254.169.254`), and IPv4-mapped IPv6. Validating at connect time also blocks DNS rebinding.
   - `redirect: 'manual'`, follow at most 3 redirects, re-running steps 1 and 5 on each hop.
   - Timeout via `AbortSignal.timeout(5_000)` (see time budget in 3D notes).
   - Stream the body and abort past 2 MB.
   - Accept `text/html` only for now (PDF support later). Otherwise `UNSUPPORTED_CONTENT`.
   - Send an identifiable `User-Agent` (e.g. `KairosBot/1.0 (+repo URL)`).

### D. Extraction Pipeline

Lives in `lib/scrape/` and `lib/ai/`.

1. **Structured data first** (`extractJsonLd`)
   - Parse `<script type="application/ld+json">`. If a `JobPosting` or `EducationalOccupationalProgram` is present, pre-fill `title`, `hiringOrganization`, `validThrough` (deadline), and `jobLocation`. These are more reliable than AI output.
   - Also read `<title>`, `og:title`, `og:site_name`, and `meta description`.
2. **Main text** (`extractMainText`)
   - Remove `script, style, noscript, svg, iframe, nav, header, footer, aside, form`, and common cookie/ad selectors.
   - Prefer `main`, `article`, or `[role=main]`, and fall back to `body`.
   - Collapse whitespace and truncate to ~20,000 characters.
3. **Thin content check**
   - If the main text is under ~500 characters, the page is likely JavaScript-rendered. Return `THIN_CONTENT` so the UI offers the paste-text fallback.
4. **AI extraction** (`extractWithGemini`)
   - `responseMimeType: 'application/json'` with a `responseSchema` matching the zod schema. `temperature: 0`.
   - Use a Flash model with thinking disabled (`thinkingBudget: 0`) to keep latency low. Gemini call timeout ~4s.
   - The prompt includes today's date (to resolve relative dates such as "applications close in two weeks") and the JSON-LD/meta hints.
   - Page text is wrapped in clear delimiters and treated as untrusted data. The prompt tells the model to ignore any instructions inside it (prompt injection).
   - Rules: return `null` for anything not stated, never invent dates, format dates as `YYYY-MM-DD`, set `deadline_type` to ROLLING when stated, and only suggest `status_override: CLOSED` when the page explicitly says applications are closed.
   - Output fields: `title`, `organization`, `type`, `opens_at`, `deadline`, `deadline_type`, `eligibility[]`, `location`, `field`, `funding`, `status_override`.
5. **Validate** (`zod`)
   - Parse the response and check date formats. On failure, retry once, then return `AI_FAILED` with whatever JSON-LD/meta fields were found, so the form is partially filled.
6. **Merge & respond**
   - JSON-LD values override AI values where both exist. Return `{ data, warnings[] }`, e.g. "deadline not found", "deadline is in the past".

**Paste-text mode:** `/api/extract` also accepts `{ url, text }`. When `text` is provided, skip the fetch (steps C5, D1, D2) and send the pasted text through D3 to D6. The URL is still validated, normalized, and duplicate-checked.

**Notes:**

- Gemini free tier inputs may be used by Google to improve its products. Only public page content is sent, never user data.
- **Time budget (Netlify):** synchronous functions default to a 10s limit. Budget: URL checks + DB lookups ~0.5s, fetch ≤5s, Gemini ~4s. The route runs on the Node.js runtime (not Edge) so `undici` works. If the budget is exceeded, the paste-text fallback covers it.
- The route requires a valid Supabase session. Unauthenticated requests get 401.

### E. API Error Codes (`/api/extract`)

| Code                  | HTTP | UI behaviour                    |
| --------------------- | ---- | ------------------------------- |
| `INVALID_URL`         | 400  | Inline field error              |
| `BLOCKED_HOST`        | 400  | "This URL can't be fetched"     |
| `DUPLICATE`           | 409  | Link to existing program        |
| `RATE_LIMITED`        | 429  | "Try again later"               |
| `FETCH_FAILED`        | 502  | Offer paste-text / manual entry |
| `UNSUPPORTED_CONTENT` | 415  | Offer paste-text / manual entry |
| `THIN_CONTENT`        | 422  | Offer paste-text / manual entry |
| `AI_FAILED`           | 502  | Show partially filled form      |

### F. Suggested Module Layout

```
app/api/extract/route.ts      # orchestration only
lib/url/validate.ts           # C1
lib/url/normalize.ts          # C2
lib/scrape/safe-fetch.ts      # C5
lib/scrape/json-ld.ts         # D1
lib/scrape/extract-text.ts    # D2, D3
lib/ai/schema.ts              # zod schema + responseSchema
lib/ai/prompt.ts              # prompt builder (pure, testable)
lib/ai/gemini.ts              # Gemini client wrapper
lib/rate-limit.ts             # C4
```

---

## 🧪 4. Testing Strategy

To maintain a high-quality open-source project, testing is built in from the start.

- **Unit Tests (Vitest):**
  - `validateUrl` / `normalizeUrl`: schemes, credentials, ports, tracking params, edge cases.
  - IP checks: localhost, private ranges, link-local, IPv6 loopback, IPv4-mapped IPv6.
  - `extractJsonLd` and `extractMainText` against saved HTML fixtures (static page, JS-rendered shell, JobPosting page).
  - Prompt builder and zod schema.
  - Derived status logic.
- **Component Tests (React Testing Library):** `ProgramCard`, the submission form (including error states and fallbacks), and filters.
- **Integration Tests:** `/api/extract` with Gemini and the network mocked (e.g. `msw`). Covers every error code in 3E, redirect handling, and the paste-text mode.
- **Database Tests:** RLS policies tested against local Supabase. A user cannot update, delete, or insert rows as another user, and hidden rows are not publicly readable.
- **End-to-End (Playwright):** Against local Supabase with email/password test users (not OAuth). Covers log in, paste link, review AI data, submit, and see it on the board.

---

## 🗺️ 5. Implementation Roadmap

### Phase 1: Foundation & Architecture

- [x] Initialize git and Next.js project (TypeScript, Tailwind, App Router), `.nvmrc`, `.env.example`, MIT `LICENSE`.
- [x] Configure ESLint, Prettier, and husky + lint-staged hooks.
- [x] Set up testing (Vitest, React Testing Library).
- [x] Set up Supabase CLI with local dev, migrations (schema, enums, view, RLS), and a seed script.
- [x] Generate Supabase TypeScript types.
- [x] Create GitHub repo `kairos-board` (user) and link it to Netlify (user).
- [x] GitHub Actions: CI (lint, typecheck, unit tests) on PRs, migrations on `main`, scheduled Supabase keep-alive.
- [x] Add `netlify.toml` (build command, Node version).

### Phase 2: Core UI & Public Board

- [ ] Build global layout (Navbar, Footer).
- [ ] Create `ProgramCard` component (with tests).
- [ ] Fetch from `programs_public` and render the board.
- [ ] Add filtering (status, type), search (title/organization), and pagination.

### Phase 3: The AI Engine (Backend)

- [ ] URL validation and normalization utilities (with tests).
- [ ] SSRF-safe fetch utility (with tests).
- [ ] JSON-LD and main-text extraction with `cheerio` (with fixture tests).
- [ ] Gemini integration with `responseSchema` + zod validation.
- [ ] Rate limiting via `extraction_logs`.
- [ ] `/api/extract` route with paste-text mode and error codes.
- [ ] Integration tests for the route (mocked Gemini and network).

### Phase 4: Authentication & Submission

- [ ] Implement Supabase Auth (GitHub/Google OAuth, plus email/password for testing).
- [ ] Build the "Add Program" form with AI auto-fill, warnings, and paste-text/manual fallbacks.
- [ ] Handle duplicates (link to existing program).
- [ ] Connect the form to Supabase for insertion. Allow editing and deleting own submissions.
- [ ] RLS policy tests.
- [ ] Playwright E2E for the submission flow (added to CI).

### Phase 5: Moderation, Open-Source Polish & Deploy

- [ ] "Report" button and `reports` table. Maintainers hide entries via `is_hidden`.
- [ ] Write a comprehensive `README.md` (setup, tech stack, env vars).
- [ ] Write a `CONTRIBUTING.md` (running tests, local Supabase, PR guidelines).
- [ ] Production deploy on Netlify (env vars, OAuth redirect URLs, custom domain optional).

### Later / Nice to Have

- [ ] PDF support for extraction.
- [ ] Headless-browser fallback for JavaScript-rendered pages (separate service, not on Netlify functions).
- [ ] Cache extraction results by `url_normalized`.
- [ ] Deadline reminders / saved programs per user.
