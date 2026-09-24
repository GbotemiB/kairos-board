import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn(() => ({ from: vi.fn() })));
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

import { createPublicClient } from "@/lib/supabase/public";

describe("createPublicClient", () => {
  beforeEach(() => {
    createClientMock.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a client with the public URL and publishable key", () => {
    createPublicClient();

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_test",
      expect.any(Object),
    );
  });

  it("does not persist or refresh sessions", () => {
    createPublicClient();

    expect(createClientMock).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });

  it("throws a clear error when the URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    expect(() => createPublicClient()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("throws a clear error when the publishable key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => createPublicClient()).toThrow("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
