export const MAX_URL_LENGTH = 2048;

const ALLOWED_PORTS = new Set(["", "80", "443"]);
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export type UrlValidationResult = { ok: true; url: URL } | { ok: false; message: string };

/**
 * Checks a user-pasted link before anything is fetched. Private and reserved
 * IP addresses are blocked later, at connect time, by the safe fetch.
 */
export function validateUrl(input: string): UrlValidationResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: false, message: "Enter a link." };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, message: `Links can be at most ${MAX_URL_LENGTH} characters.` };
  }

  // People often paste "example.org/apply" without a scheme.
  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, message: "That doesn't look like a valid link." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, message: "Only http:// and https:// links are supported." };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, message: "Links with a username or password are not supported." };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, message: "Links with a custom port are not supported." };
  }
  // Single-label hosts (localhost, intranet names) are never public pages.
  const isIpv6Literal = url.hostname.startsWith("[");
  if (!isIpv6Literal && !url.hostname.includes(".")) {
    return { ok: false, message: "Enter a full public link, like https://example.org/apply." };
  }

  return { ok: true, url };
}
