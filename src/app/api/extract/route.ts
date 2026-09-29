import type { NextRequest } from "next/server";
import { z } from "zod";

import { createDefaultGenerate, getGeminiModels, type GenerateJson } from "@/lib/ai/gemini";
import { getCurrentUser } from "@/lib/auth/session";
import { extractProgram } from "@/lib/extract/extract-program";
import { checkRateLimit, recordExtraction } from "@/lib/extract/extraction-log";
import { STATUS_BY_CODE, errorResponse, toApiResponse } from "@/lib/extract/http";
import { isSameOrigin } from "@/lib/http/same-origin";
import { findProgramByNormalizedUrl } from "@/lib/programs/duplicates";
import { createServerSupabase } from "@/lib/supabase/server";

/** Retry hint when Gemini is out of quota or overloaded. */
const AI_BUSY_RETRY_SECONDS = 60;

const bodySchema = z.object({
  url: z.string().max(4096),
  text: z.string().max(100_000).optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  try {
    return await handleExtract(request);
  } catch (error) {
    // Never answer with an HTML error page: the client expects JSON.
    console.error("Unexpected error in /api/extract", error);
    return errorResponse("UNAVAILABLE", "Something went wrong. Please try again shortly.");
  }
}

async function handleExtract(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) {
    return errorResponse("FORBIDDEN_ORIGIN", "Cross-site requests are not allowed.");
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return errorResponse("UNSUPPORTED_MEDIA_TYPE", "Send the request as JSON.");
  }

  const user = await getCurrentUser();
  if (user === null) {
    return errorResponse("UNAUTHENTICATED", "Sign in to add programs.");
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse("INVALID_REQUEST", "The request is missing a valid link.");
    }
    body = parsed.data;
  } catch {
    return errorResponse("INVALID_REQUEST", "The request body is not valid JSON.");
  }

  const supabase = await createServerSupabase();
  const limit = await checkRateLimit(supabase, user.id);
  if (!limit.ok) {
    return errorResponse("UNAVAILABLE", "Something went wrong. Please try again shortly.");
  }
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return errorResponse(
      "RATE_LIMITED",
      `You've reached the limit for automatic extraction. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}, or fill in the details yourself.`,
      { retryAfterSeconds: limit.retryAfterSeconds },
    );
  }

  let generate: GenerateJson | undefined;
  const result = await extractProgram(
    { url: body.url, text: body.text },
    {
      findDuplicate: (normalized) => findProgramByNormalizedUrl(supabase, normalized),
      // Created only if the AI step is reached, so a missing key cannot break
      // duplicate, blocked-link or thin-page responses.
      generate: (generateRequest) => (generate ??= createDefaultGenerate())(generateRequest),
      models: getGeminiModels(),
    },
  );

  console.info("extract", {
    user: user.id,
    outcome: result.ok ? "SUCCESS" : result.code,
    timings: result.timings,
    attempts: result.attempts,
  });

  // Invalid links cost nothing, so they do not count toward the limit.
  if (result.normalizedUrl !== null && !(result.ok === false && result.code === "INVALID_URL")) {
    await recordExtraction(supabase, result.normalizedUrl, result.ok ? "SUCCESS" : result.code);
  }

  const headers = new Headers();
  if (!result.ok && result.code === "AI_BUSY") {
    headers.set("Retry-After", String(AI_BUSY_RETRY_SECONDS));
  }
  return Response.json(toApiResponse(result), {
    status: result.ok ? 200 : STATUS_BY_CODE[result.code],
    headers,
  });
}
