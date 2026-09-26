import { lookup as dnsLookup, type LookupAddress, type LookupAllOptions } from "node:dns";
import { isIP, type LookupFunction } from "node:net";

import { Agent, request } from "undici";

import { isPublicIp } from "@/lib/scrape/ip";

export const USER_AGENT = "KairosBot/1.0 (+https://github.com/GbotemiB/kairos-board)";
export const DEFAULT_TIMEOUT_MS = 5_000;
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
export const DEFAULT_MAX_REDIRECTS = 3;

const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type SafeFetchErrorCode = "BLOCKED_HOST" | "FETCH_FAILED" | "UNSUPPORTED_CONTENT";

export type SafeFetchResult =
  | { ok: true; finalUrl: URL; html: string; truncated: boolean }
  | { ok: false; code: SafeFetchErrorCode; message: string };

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Test seam. Production always uses the default public-IP check. */
  isAllowedAddress?: (address: string) => boolean;
  /** Test seam. Production only allows the default ports. */
  allowedPorts?: ReadonlySet<string>;
};

const DEFAULT_PORTS: ReadonlySet<string> = new Set(["", "80", "443"]);

class BlockedHostError extends Error {
  constructor(hostname: string) {
    super(`Refusing to connect to non-public address for ${hostname}`);
    this.name = "BlockedHostError";
  }
}

/**
 * DNS lookup that rejects the connection if any resolved address is not
 * allowed. Runs at connect time, so a host cannot pass a pre-check and then
 * rebind to a private address.
 */
export function createSafeLookup(isAllowedAddress: (address: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    const allOptions: LookupAllOptions = { ...options, all: true };
    dnsLookup(hostname, allOptions, (error, addresses: LookupAddress[]) => {
      if (error !== null) {
        callback(error, "", 0);
        return;
      }
      if (addresses.length === 0 || addresses.some(({ address }) => !isAllowedAddress(address))) {
        callback(new BlockedHostError(hostname), "", 0);
        return;
      }
      if (options.all === true) {
        (callback as unknown as (err: null, addresses: LookupAddress[]) => void)(null, addresses);
        return;
      }
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

function checkTarget(
  url: URL,
  allowedPorts: ReadonlySet<string>,
  isAllowedAddress: (address: string) => boolean,
): { ok: true } | { ok: false; code: SafeFetchErrorCode; message: string } {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, code: "BLOCKED_HOST", message: `Unsupported protocol ${url.protocol}` };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, code: "BLOCKED_HOST", message: "URLs with credentials are not fetched" };
  }
  if (!allowedPorts.has(url.port)) {
    return { ok: false, code: "BLOCKED_HOST", message: `Port ${url.port} is not allowed` };
  }
  // Node skips DNS lookup for IP literals, so check them here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && !isAllowedAddress(host)) {
    return { ok: false, code: "BLOCKED_HOST", message: `Address ${host} is not public` };
  }
  return { ok: true };
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function charsetFrom(contentType: string): string {
  const match = /charset=["']?([^;"'\s]+)/i.exec(contentType);
  return match === null ? "utf-8" : match[1].toLowerCase();
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    // Unknown charset label.
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function isBlockedHostError(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current instanceof BlockedHostError) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

/**
 * Fetches an HTML page from the public internet with SSRF protections,
 * manual redirects, an overall timeout and a size cap.
 */
export async function safeFetch(
  input: URL,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    isAllowedAddress = isPublicIp,
    allowedPorts = DEFAULT_PORTS,
  }: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const signal = AbortSignal.timeout(timeoutMs);
  const dispatcher = new Agent({
    connect: { lookup: createSafeLookup(isAllowedAddress) },
    // Keep individual phases within the overall budget.
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });

  try {
    let url = input;
    for (let hop = 0; ; hop++) {
      const target = checkTarget(url, allowedPorts, isAllowedAddress);
      if (!target.ok) {
        return target;
      }

      const response = await request(url, {
        method: "GET",
        dispatcher,
        signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        },
      });

      if (REDIRECT_STATUSES.has(response.statusCode)) {
        await response.body.dump();
        const location = headerValue(response.headers.location);
        if (location === undefined) {
          return { ok: false, code: "FETCH_FAILED", message: "Redirect without a location" };
        }
        if (hop >= maxRedirects) {
          return { ok: false, code: "FETCH_FAILED", message: "Too many redirects" };
        }
        url = new URL(location, url);
        continue;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        await response.body.dump();
        return {
          ok: false,
          code: "FETCH_FAILED",
          message: `The page responded with HTTP ${response.statusCode}`,
        };
      }

      const contentType = headerValue(response.headers["content-type"]) ?? "";
      if (!HTML_CONTENT_TYPES.some((type) => contentType.toLowerCase().includes(type))) {
        await response.body.dump();
        return {
          ok: false,
          code: "UNSUPPORTED_CONTENT",
          message: `Unsupported content type ${contentType === "" ? "(none)" : contentType}`,
        };
      }

      const chunks: Uint8Array[] = [];
      let received = 0;
      let truncated = false;
      for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
        const remaining = maxBytes - received;
        if (chunk.byteLength > remaining) {
          chunks.push(chunk.subarray(0, remaining));
          received = maxBytes;
          truncated = true;
          response.body.destroy();
          break;
        }
        chunks.push(chunk);
        received += chunk.byteLength;
      }

      const bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return { ok: true, finalUrl: url, html: decode(bytes, charsetFrom(contentType)), truncated };
    }
  } catch (error) {
    if (isBlockedHostError(error)) {
      return { ok: false, code: "BLOCKED_HOST", message: "This address can't be fetched" };
    }
    if (signal.aborted) {
      return { ok: false, code: "FETCH_FAILED", message: "The page took too long to respond" };
    }
    return {
      ok: false,
      code: "FETCH_FAILED",
      message: error instanceof Error ? error.message : "The page could not be fetched",
    };
  } finally {
    await dispatcher.destroy().catch(() => {});
  }
}
