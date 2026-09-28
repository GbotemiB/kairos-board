// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type CookieMethods = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: { name: string; value: string; options: Record<string, unknown> }[],
    headers: Record<string, string>,
  ) => void;
};

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  cookies: null as CookieMethods | null,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, options: { cookies: CookieMethods }) => {
    mocks.cookies = options.cookies;
    return { auth: { getClaims: mocks.getClaims } };
  }),
}));

import { updateSession } from "@/lib/supabase/proxy";

describe("updateSession", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    mocks.getClaims.mockReset();
  });

  it("validates the session on every request", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });

    await updateSession(new NextRequest("http://localhost:3000/"));

    expect(mocks.getClaims).toHaveBeenCalledTimes(1);
  });

  it("exposes the request cookies to Supabase", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    const request = new NextRequest("http://localhost:3000/", {
      headers: { cookie: "sb-auth-token=abc; other=1" },
    });

    await updateSession(request);

    expect(mocks.cookies?.getAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "sb-auth-token", value: "abc" }),
        expect.objectContaining({ name: "other", value: "1" }),
      ]),
    );
  });

  it("writes refreshed cookies and no-cache headers to the response", async () => {
    mocks.getClaims.mockImplementation(async () => {
      mocks.cookies?.setAll(
        [{ name: "sb-auth-token", value: "refreshed", options: { path: "/", httpOnly: true } }],
        {
          "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
          Expires: "0",
          Pragma: "no-cache",
        },
      );
      return { data: { claims: { sub: "user-1" } }, error: null };
    });

    const response = await updateSession(new NextRequest("http://localhost:3000/"));

    expect(response.cookies.get("sb-auth-token")?.value).toBe("refreshed");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });

  it("leaves the response cacheable when no cookies change", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });

    const response = await updateSession(new NextRequest("http://localhost:3000/"));

    expect(response.headers.get("cache-control")).toBeNull();
  });

  describe("protected pages", () => {
    it.each(["/submit", "/submit/", "/submit/step"])(
      "redirects signed-out visitors from %s to login",
      async (path) => {
        mocks.getClaims.mockResolvedValue({ data: null, error: null });

        const response = await updateSession(new NextRequest(`http://localhost:3000${path}?x=1`));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
          `http://localhost:3000/login?next=${encodeURIComponent(`${path}?x=1`)}`,
        );
      },
    );

    it("lets signed-in users through", async () => {
      mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });

      const response = await updateSession(new NextRequest("http://localhost:3000/submit"));

      expect(response.headers.get("location")).toBeNull();
    });

    it.each(["/", "/login", "/submitted", "/api/extract"])(
      "does not redirect from %s",
      async (path) => {
        mocks.getClaims.mockResolvedValue({ data: null, error: null });

        const response = await updateSession(new NextRequest(`http://localhost:3000${path}`));

        expect(response.headers.get("location")).toBeNull();
      },
    );

    it("keeps cookie changes on the redirect", async () => {
      mocks.getClaims.mockImplementation(async () => {
        mocks.cookies?.setAll([{ name: "sb-auth-token", value: "", options: { maxAge: 0 } }], {});
        return { data: null, error: null };
      });

      const response = await updateSession(new NextRequest("http://localhost:3000/submit"));

      expect(response.status).toBe(307);
      expect(response.cookies.get("sb-auth-token")?.value).toBe("");
    });
  });
});
