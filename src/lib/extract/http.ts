import type { ExtractedProgram } from "@/lib/ai/schema";
import type { ExtractErrorCode, ExtractResult } from "@/lib/extract/extract-program";
import type { ExistingProgram } from "@/lib/programs/duplicates";

export type ApiErrorCode =
  | ExtractErrorCode
  | "UNAUTHENTICATED"
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  INVALID_URL: 400,
  BLOCKED_HOST: 400,
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN_ORIGIN: 403,
  DUPLICATE: 409,
  UNSUPPORTED_CONTENT: 415,
  UNSUPPORTED_MEDIA_TYPE: 415,
  THIN_CONTENT: 422,
  RATE_LIMITED: 429,
  FETCH_FAILED: 502,
  AI_FAILED: 502,
  AI_BUSY: 503,
  UNAVAILABLE: 503,
};

/** What the browser receives. Timings and provider error details stay server-side. */
export type ExtractApiResponse =
  | {
      ok: true;
      url: string;
      normalizedUrl: string;
      data: ExtractedProgram;
      warnings: string[];
    }
  | {
      ok: false;
      code: ApiErrorCode;
      message: string;
      existing?: ExistingProgram;
      partial?: ExtractedProgram;
    };

export function toApiResponse(result: ExtractResult): ExtractApiResponse {
  if (result.ok) {
    return {
      ok: true,
      url: result.url,
      normalizedUrl: result.normalizedUrl,
      data: result.data,
      warnings: result.warnings,
    };
  }
  return {
    ok: false,
    code: result.code,
    message: result.message,
    ...(result.existing === null ? {} : { existing: result.existing }),
    ...(result.partial === null ? {} : { partial: result.partial }),
  };
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  init: { retryAfterSeconds?: number } = {},
): Response {
  const headers = new Headers();
  if (init.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(init.retryAfterSeconds));
  }
  return Response.json({ ok: false, code, message } satisfies ExtractApiResponse, {
    status: STATUS_BY_CODE[code],
    headers,
  });
}
