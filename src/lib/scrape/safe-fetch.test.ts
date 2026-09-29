// @vitest-environment node
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  USER_AGENT,
  createSafeLookup,
  safeFetch,
  type SafeFetchOptions,
} from "@/lib/scrape/safe-fetch";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let server: Server;
let port: number;
let handler: Handler;

beforeAll(async () => {
  server = createServer((req, res) => handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  handler = (_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<html><body>Hello</body></html>");
  };
});

/** Options that let the local test server through while keeping every other check. */
function allowLocal(overrides: SafeFetchOptions = {}): SafeFetchOptions {
  return {
    isAllowedAddress: (address) => address === "127.0.0.1" || address === "::1",
    allowedPorts: new Set(["", "80", "443", String(port)]),
    ...overrides,
  };
}

function local(path = "/", host = "127.0.0.1"): URL {
  return new URL(`http://${host}:${port}${path}`);
}

describe("safeFetch", () => {
  describe("successful fetches", () => {
    it("returns the HTML and final URL", async () => {
      const result = await safeFetch(local("/page"), allowLocal());

      expect(result).toEqual({
        ok: true,
        finalUrl: local("/page"),
        html: "<html><body>Hello</body></html>",
        truncated: false,
      });
    });

    it("identifies itself with the Kairos user agent", async () => {
      let userAgent: string | undefined;
      handler = (req, res) => {
        userAgent = req.headers["user-agent"];
        res.writeHead(200, { "content-type": "text/html" });
        res.end("ok");
      };

      await safeFetch(local(), allowLocal());

      expect(userAgent).toBe(USER_AGENT);
    });

    it("accepts application/xhtml+xml", async () => {
      handler = (_req, res) => {
        res.writeHead(200, { "content-type": "application/xhtml+xml" });
        res.end("<html/>");
      };

      expect((await safeFetch(local(), allowLocal())).ok).toBe(true);
    });

    it("decodes using the declared charset", async () => {
      handler = (_req, res) => {
        res.writeHead(200, { "content-type": "text/html; charset=ISO-8859-1" });
        res.end(Buffer.from([0x63, 0x61, 0x66, 0xe9])); // "café" in Latin-1
      };

      const result = await safeFetch(local(), allowLocal());

      expect(result.ok && result.html).toBe("café");
    });

    it("falls back to UTF-8 for an unknown charset label", async () => {
      handler = (_req, res) => {
        res.writeHead(200, { "content-type": "text/html; charset=not-a-charset" });
        res.end("naïve");
      };

      const result = await safeFetch(local(), allowLocal());

      expect(result.ok && result.html).toBe("naïve");
    });
  });

  describe("size cap", () => {
    it("truncates bodies larger than maxBytes", async () => {
      handler = (_req, res) => {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("a".repeat(5000));
      };

      const result = await safeFetch(local(), allowLocal({ maxBytes: 1000 }));

      expect(result.ok && result.html.length).toBe(1000);
      expect(result.ok && result.truncated).toBe(true);
    });

    it("does not flag a body of exactly maxBytes as truncated", async () => {
      handler = (_req, res) => {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("a".repeat(1000));
      };

      const result = await safeFetch(local(), allowLocal({ maxBytes: 1000 }));

      expect(result.ok && result.html.length).toBe(1000);
      expect(result.ok && result.truncated).toBe(false);
    });
  });

  describe("blocked targets", () => {
    it("blocks a private IP literal with the default address check", async () => {
      const result = await safeFetch(local(), {
        allowedPorts: new Set(["", "80", "443", String(port)]),
      });

      expect(result).toMatchObject({ ok: false, code: "BLOCKED_HOST" });
    });

    it("blocks an IPv6 loopback literal", async () => {
      const result = await safeFetch(new URL(`http://[::1]:${port}/`), {
        allowedPorts: new Set(["", "80", "443", String(port)]),
      });

      expect(result).toMatchObject({ ok: false, code: "BLOCKED_HOST" });
    });

    it("blocks a hostname that resolves to a private address (checked at DNS lookup)", async () => {
      const result = await safeFetch(local("/", "localhost"), {
        allowedPorts: new Set(["", "80", "443", String(port)]),
      });

      expect(result).toMatchObject({ ok: false, code: "BLOCKED_HOST" });
    });

    it("blocks non-default ports by default", async () => {
      const result = await safeFetch(local(), {
        isAllowedAddress: () => true,
      });

      expect(result).toMatchObject({
        ok: false,
        code: "BLOCKED_HOST",
        message: expect.stringMatching(/Port/),
      });
    });

    it("blocks URLs with credentials", async () => {
      const url = local();
      url.username = "user";

      expect(await safeFetch(url, allowLocal())).toMatchObject({ ok: false, code: "BLOCKED_HOST" });
    });

    it("blocks non-http protocols", async () => {
      expect(await safeFetch(new URL("ftp://example.org/file"), allowLocal())).toMatchObject({
        ok: false,
        code: "BLOCKED_HOST",
      });
    });
  });

  describe("redirects", () => {
    it("follows a relative redirect and reports the final URL", async () => {
      handler = (req, res) => {
        if (req.url === "/start") {
          res.writeHead(302, { location: "/final" });
          res.end();
          return;
        }
        res.writeHead(200, { "content-type": "text/html" });
        res.end(`at ${req.url}`);
      };

      const result = await safeFetch(local("/start"), allowLocal());

      expect(result).toMatchObject({ ok: true, html: "at /final", finalUrl: local("/final") });
    });

    it("stops after maxRedirects", async () => {
      let hits = 0;
      handler = (_req, res) => {
        hits++;
        res.writeHead(301, { location: `/hop-${hits}` });
        res.end();
      };

      const result = await safeFetch(local("/"), allowLocal({ maxRedirects: 2 }));

      expect(result).toEqual({ ok: false, code: "FETCH_FAILED", message: "Too many redirects" });
      expect(hits).toBe(3);
    });

    it("re-checks each redirect target and blocks one pointing at cloud metadata", async () => {
      handler = (_req, res) => {
        res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
        res.end();
      };

      expect(await safeFetch(local("/"), allowLocal())).toMatchObject({
        ok: false,
        code: "BLOCKED_HOST",
      });
    });

    it("blocks a redirect to a non-http protocol", async () => {
      handler = (_req, res) => {
        res.writeHead(302, { location: "file:///etc/passwd" });
        res.end();
      };

      expect(await safeFetch(local("/"), allowLocal())).toMatchObject({
        ok: false,
        code: "BLOCKED_HOST",
      });
    });

    it("fails on a redirect without a location header", async () => {
      handler = (_req, res) => {
        res.writeHead(302);
        res.end();
      };

      expect(await safeFetch(local("/"), allowLocal())).toEqual({
        ok: false,
        code: "FETCH_FAILED",
        message: "Redirect without a location",
      });
    });
  });

  describe("responses that are not usable pages", () => {
    it.each([404, 500, 403])("fails on HTTP %i", async (status) => {
      handler = (_req, res) => {
        res.writeHead(status, { "content-type": "text/html" });
        res.end("nope");
      };

      expect(await safeFetch(local(), allowLocal())).toEqual({
        ok: false,
        code: "FETCH_FAILED",
        message: `The page responded with HTTP ${status}`,
      });
    });

    it.each(["application/pdf", "application/json", "image/png"])(
      "rejects the content type %s",
      async (contentType) => {
        handler = (_req, res) => {
          res.writeHead(200, { "content-type": contentType });
          res.end("data");
        };

        expect(await safeFetch(local(), allowLocal())).toMatchObject({
          ok: false,
          code: "UNSUPPORTED_CONTENT",
        });
      },
    );

    it("rejects a response with no content type", async () => {
      handler = (_req, res) => {
        res.writeHead(200);
        res.end("data");
      };

      expect(await safeFetch(local(), allowLocal())).toEqual({
        ok: false,
        code: "UNSUPPORTED_CONTENT",
        message: "Unsupported content type (none)",
      });
    });

    it("times out on a slow server", async () => {
      handler = () => {
        // Never respond.
      };

      const result = await safeFetch(local(), allowLocal({ timeoutMs: 200 }));

      expect(result).toEqual({
        ok: false,
        code: "FETCH_FAILED",
        message: "The page took too long to respond",
      });
    });

    it("fails when nothing is listening", async () => {
      const closed = createServer();
      await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
      const closedPort = (closed.address() as AddressInfo).port;
      await new Promise<void>((resolve) => closed.close(() => resolve()));

      const result = await safeFetch(new URL(`http://127.0.0.1:${closedPort}/`), {
        isAllowedAddress: () => true,
        allowedPorts: new Set([String(closedPort)]),
      });

      expect(result).toMatchObject({ ok: false, code: "FETCH_FAILED" });
    });
  });
});

describe("createSafeLookup", () => {
  it("returns the first address when a single result is requested", async () => {
    const lookup = createSafeLookup(() => true);

    const result = await new Promise<{ address: string; family: number }>((resolve, reject) => {
      lookup("localhost", { family: 4 }, (error, address, family) => {
        if (error) reject(error);
        else resolve({ address: address as string, family: family as number });
      });
    });

    expect(result).toEqual({ address: "127.0.0.1", family: 4 });
  });

  it("returns every address when all results are requested", async () => {
    const lookup = createSafeLookup(() => true);

    const addresses = await new Promise<unknown>((resolve, reject) => {
      lookup("localhost", { family: 4, all: true }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    expect(addresses).toEqual(expect.arrayContaining([{ address: "127.0.0.1", family: 4 }]));
  });

  it("rejects when a resolved address is not allowed", async () => {
    const lookup = createSafeLookup(() => false);

    const error = await new Promise<Error | null>((resolve) => {
      lookup("localhost", {}, (err) => resolve(err));
    });

    expect(error?.message).toMatch(/non-public address for localhost/);
  });

  it("passes DNS errors through", async () => {
    const lookup = createSafeLookup(() => true);

    const error = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      lookup("does-not-exist.invalid", {}, (err) => resolve(err));
    });

    expect(error?.code).toBe("ENOTFOUND");
  });
});
