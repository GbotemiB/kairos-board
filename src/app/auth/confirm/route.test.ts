// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({ auth: { verifyOtp } })),
}));

import { GET } from "@/app/auth/confirm/route";

function request(query: string) {
  return new NextRequest(`http://localhost:3000/auth/confirm?${query}`);
}

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
  });

  it("verifies the token and redirects to the next path", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(request("token_hash=abc&type=signup&next=%2Fsubmit"));

    expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "abc" });
    expect(response.headers.get("location")).toBe("http://localhost:3000/submit");
  });

  it("does not follow an unsafe next path", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(request("token_hash=abc&type=email&next=%2F%2Fevil.com"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("sends the user to login with an error when verification fails", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });

    const response = await GET(request("token_hash=abc&type=signup"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=confirmation");
  });

  it.each(["token_hash=abc", "type=signup", "token_hash=abc&type=bogus"])(
    "rejects incomplete or invalid parameters (%s) without calling Supabase",
    async (query) => {
      const response = await GET(request(query));

      expect(verifyOtp).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/login?error=confirmation",
      );
    },
  );
});
