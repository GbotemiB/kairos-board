import type { ExtractApiResponse } from "@/lib/extract/http";

/** Calls /api/extract from the browser. Network or server failures become an error response. */
export async function requestExtraction(input: {
  url: string;
  text?: string;
}): Promise<ExtractApiResponse> {
  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
      // A hosting-level error page (e.g. a function timeout), not our API.
      return {
        ok: false,
        code: "UNAVAILABLE",
        message:
          response.status === 502 || response.status === 504
            ? "This took too long. Try again, or paste the page text instead."
            : "Something went wrong on our side. Please try again shortly.",
      };
    }
    return (await response.json()) as ExtractApiResponse;
  } catch {
    return {
      ok: false,
      code: "UNAVAILABLE",
      message: "We couldn't reach the server. Check your connection and try again.",
    };
  }
}
