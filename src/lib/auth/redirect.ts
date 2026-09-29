/**
 * Only allows same-site relative paths, so `?next=` cannot be used as an open
 * redirect (e.g. `//evil.com`, `https://evil.com`, `/\\evil.com`).
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value === "") {
    return fallback;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  // Reject control characters and backslashes anywhere; browsers normalize them.
  if (/[\u0000-\u001f\\]/.test(value)) {
    return fallback;
  }
  try {
    const parsed = new URL(value, "http://kairos.invalid");
    if (parsed.origin !== "http://kairos.invalid") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
