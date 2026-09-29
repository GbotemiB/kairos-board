// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MIN_TEXT_CHARS, readPage } from "@/lib/scrape/read-page";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf-8");
}

describe("readPage", () => {
  describe("static fellowship page", () => {
    const page = readPage(fixture("static-page.html"));

    it("reads page metadata, preferring og:title", () => {
      expect(page.meta).toEqual({
        title: "Graduate Climate Fellowship 2027",
        siteName: "Example Climate Institute",
        description: "A funded fellowship for master's students working on climate policy.",
      });
    });

    it("has no structured data", () => {
      expect(page.structured).toBeNull();
    });

    it("keeps the main content", () => {
      expect(page.text).toContain("Graduate Climate Fellowship 2027");
      expect(page.text).toContain("Currently enrolled in a master's program");
      expect(page.text).toContain("Applications close on 15 November 2026.");
      expect(page.text).toContain("Lisbon, Portugal");
    });

    it("drops navigation, cookie banners, sidebars, footers and scripts", () => {
      for (const noise of [
        "About us",
        "Accept all cookies",
        "Other opportunities",
        "Privacy policy",
        "analytics",
      ]) {
        expect(page.text).not.toContain(noise);
      }
    });

    it("is not thin", () => {
      expect(page.text.length).toBeGreaterThanOrEqual(MIN_TEXT_CHARS);
      expect(page.isThin).toBe(false);
      expect(page.textTruncated).toBe(false);
    });
  });

  describe("JavaScript-rendered shell", () => {
    const page = readPage(fixture("js-shell.html"));

    it("is flagged as thin so the user can paste the text instead", () => {
      expect(page.text).toBe("");
      expect(page.structured).toBeNull();
      expect(page.isThin).toBe(true);
    });

    it("falls back to the <title> when there is no og:title", () => {
      expect(page.meta).toEqual({ title: "Careers", siteName: null, description: null });
    });
  });

  describe("job board page with JSON-LD but little text", () => {
    const page = readPage(fixture("job-posting.html"));

    it("reads the structured JobPosting", () => {
      expect(page.structured).toEqual({
        source: "JobPosting",
        title: "Data Science Intern (Summer 2027)",
        organization: "Example Analytics Ltd",
        deadline: "2026-11-30",
        location: "Berlin, DE",
        type: "INTERNSHIP",
      });
    });

    it("is not thin, because structured data is usable", () => {
      expect(page.text.length).toBeLessThan(MIN_TEXT_CHARS);
      expect(page.isThin).toBe(false);
    });
  });
});
