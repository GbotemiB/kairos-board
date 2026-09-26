import { describe, expect, it } from "vitest";

import { normalizeUrl } from "@/lib/url/normalize";

function normalize(href: string): string {
  return normalizeUrl(new URL(href));
}

describe("normalizeUrl", () => {
  it("matches the seed data convention", () => {
    expect(normalize("https://example.org/research-fellowship?utm_source=newsletter")).toBe(
      "https://example.org/research-fellowship",
    );
  });

  it("lowercases the host but keeps path case", () => {
    expect(normalize("https://Careers.EXAMPLE.org/Jobs/ABC")).toBe(
      "https://careers.example.org/Jobs/ABC",
    );
  });

  it("strips a leading www.", () => {
    expect(normalize("https://www.example.org/apply")).toBe("https://example.org/apply");
  });

  it("only strips www. at the start of the host", () => {
    expect(normalize("https://jobs.www.example.org/apply")).toBe(
      "https://jobs.www.example.org/apply",
    );
  });

  it("treats http and https as the same page", () => {
    expect(normalize("http://example.org/apply")).toBe(normalize("https://example.org/apply"));
  });

  it("drops the fragment", () => {
    expect(normalize("https://example.org/apply#eligibility")).toBe("https://example.org/apply");
  });

  it("drops default ports", () => {
    expect(normalize("https://example.org:443/apply")).toBe("https://example.org/apply");
  });

  it("removes trailing slashes but keeps the root bare", () => {
    expect(normalize("https://example.org/apply/")).toBe("https://example.org/apply");
    expect(normalize("https://example.org/apply///")).toBe("https://example.org/apply");
    expect(normalize("https://example.org/")).toBe("https://example.org");
  });

  it.each([
    "utm_source",
    "UTM_Medium",
    "utm_campaign",
    "fbclid",
    "gclid",
    "msclkid",
    "mc_cid",
    "_hsenc",
  ])("removes the tracking parameter %s", (param) => {
    expect(normalize(`https://example.org/apply?${param}=x&id=42`)).toBe(
      "https://example.org/apply?id=42",
    );
  });

  it("keeps meaningful parameters, including ref (often a job reference)", () => {
    expect(normalize("https://example.org/jobs?ref=R-123&id=9")).toBe(
      "https://example.org/jobs?id=9&ref=R-123",
    );
  });

  it("sorts parameters so their order does not matter", () => {
    expect(normalize("https://example.org/jobs?b=2&a=1")).toBe(
      normalize("https://example.org/jobs?a=1&b=2"),
    );
  });

  it("sorts repeated parameters by value", () => {
    expect(normalize("https://example.org/jobs?tag=z&tag=a")).toBe(
      "https://example.org/jobs?tag=a&tag=z",
    );
  });

  it("drops the query string entirely when only tracking parameters remain", () => {
    expect(normalize("https://example.org/apply?utm_source=x&fbclid=y")).toBe(
      "https://example.org/apply",
    );
  });

  it("maps equivalent links to the same key", () => {
    const variants = [
      "https://example.org/fellowship",
      "http://www.example.org/fellowship/",
      "https://EXAMPLE.org/fellowship?utm_source=twitter#apply",
      "https://www.example.org:443/fellowship?fbclid=abc",
    ];
    expect(new Set(variants.map(normalize))).toEqual(new Set(["https://example.org/fellowship"]));
  });

  it("keeps different pages distinct", () => {
    expect(normalize("https://example.org/fellowship-a")).not.toBe(
      normalize("https://example.org/fellowship-b"),
    );
    expect(normalize("https://example.org/jobs?id=1")).not.toBe(
      normalize("https://example.org/jobs?id=2"),
    );
  });
});
