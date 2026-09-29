/**
 * Try the extraction pipeline on a real page from the terminal.
 *
 *   npm run extract -- <url>
 *   npm run extract -- <url> --text-file page.txt   # paste-text mode
 *   npm run extract -- <url> --json                 # raw JSON output
 *
 * Reads .env.local. The duplicate check uses local Supabase when it is running.
 */
import { existsSync, readFileSync } from "node:fs";

import { createDefaultGenerate, getGeminiModels } from "@/lib/ai/gemini";
import { TOTAL_BUDGET_MS, extractProgram, type ExtractResult } from "@/lib/extract/extract-program";
import { findProgramByNormalizedUrl } from "@/lib/programs/duplicates";
import { createPublicClient } from "@/lib/supabase/public";

/** Netlify synchronous functions stop at 10s; flag anything close to it. */
const NETLIFY_WARN_MS = 8_000;

function usage(): never {
  console.error("Usage: npm run extract -- <url> [--text-file <path>] [--json]");
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const args = [...argv];
  let url: string | null = null;
  let textFile: string | null = null;
  let json = false;
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--json") {
      json = true;
    } else if (arg === "--text-file") {
      textFile = args.shift() ?? usage();
    } else if (arg !== undefined && url === null) {
      url = arg;
    } else {
      usage();
    }
  }
  return { url: url ?? usage(), textFile, json };
}

function printResult(result: ExtractResult) {
  const line = (label: string, value: unknown) =>
    console.log(`  ${label.padEnd(14)} ${value === null ? "-" : String(value)}`);

  if (result.ok) {
    const { data } = result;
    console.log(
      `\n✅ Extracted (${result.model}${result.usedStructuredData ? " + JSON-LD" : ""})\n`,
    );
    line("Title", data.title);
    line("Organization", data.organization);
    line("Type", data.type);
    line("Opens", data.opensAt);
    line("Deadline", `${data.deadline ?? "-"} (${data.deadlineType})`);
    line("Location", data.location);
    line("Field", data.field);
    line("Funding", data.funding);
    line("Closed", data.applicationsClosed);
    line("For master's", data.openToMasters);
    console.log("  Eligibility");
    for (const item of data.eligibility) console.log(`    - ${item}`);
    if (data.eligibility.length === 0) console.log("    -");
    if (result.warnings.length > 0) {
      console.log("\n  Warnings");
      for (const warning of result.warnings) console.log(`    ⚠ ${warning}`);
    }
  } else {
    console.log(`\n❌ ${result.code}: ${result.message}`);
    if (result.existing !== null)
      line("Existing", `${result.existing.title} (${result.existing.id})`);
    if (result.partial !== null) console.log(`  Partial data  ${JSON.stringify(result.partial)}`);
  }

  console.log("\n  Timings");
  const { total, ...stages } = result.timings;
  for (const [stage, ms] of Object.entries(stages)) console.log(`    ${stage.padEnd(10)} ${ms} ms`);
  const flag =
    total > NETLIFY_WARN_MS ? `  ⚠ over ${NETLIFY_WARN_MS} ms (Netlify limit is 10 s)` : "";
  console.log(`    ${"total".padEnd(10)} ${total} ms${flag}`);
  for (const attempt of result.attempts) {
    console.log(
      `    ${attempt.model}: ${attempt.ms} ms${attempt.error === null ? "" : ` (${attempt.error})`}`,
    );
  }
  console.log();
}

async function main() {
  const { url, textFile, json } = parseArgs(process.argv.slice(2));
  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }

  const client = createPublicClient();
  const result = await extractProgram(
    { url, text: textFile === null ? undefined : readFileSync(textFile, "utf-8") },
    {
      findDuplicate: (normalized) => findProgramByNormalizedUrl(client, normalized),
      generate: createDefaultGenerate(),
      models: getGeminiModels(),
      budgetMs: TOTAL_BUDGET_MS,
    },
  );

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }
  process.exitCode = result.ok ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
