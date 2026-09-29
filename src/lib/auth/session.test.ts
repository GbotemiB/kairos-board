import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({ auth: { getClaims } })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import { getCurrentUser, requireUser } from "@/lib/auth/session";

describe("getCurrentUser", () => {
  beforeEach(() => {
    getClaims.mockReset();
  });

  it("returns the verified user id and email", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", email: "me@example.org" } },
      error: null,
    });

    expect(await getCurrentUser()).toEqual({ id: "user-1", email: "me@example.org" });
  });

  it("returns null when signed out", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });

    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null when the token fails verification", async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: "invalid JWT" } });

    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null when the subject claim is missing", async () => {
    getClaims.mockResolvedValue({ data: { claims: { email: "me@example.org" } }, error: null });

    expect(await getCurrentUser()).toBeNull();
  });

  it("returns a null email when the claim is absent", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });

    expect(await getCurrentUser()).toEqual({ id: "user-1", email: null });
  });
});

describe("requireUser", () => {
  it("returns the user when signed in", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", email: null } }, error: null });

    expect(await requireUser("/submit")).toEqual({ id: "user-1", email: null });
  });

  it("redirects to login with a return path when signed out", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });

    await expect(requireUser("/submit?x=1")).rejects.toThrow(
      "REDIRECT:/login?next=%2Fsubmit%3Fx%3D1",
    );
  });
});
