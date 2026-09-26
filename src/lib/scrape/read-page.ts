import { load } from "cheerio";

import { extractMainText } from "@/lib/scrape/extract-text";
import { extractJsonLd, type StructuredHints } from "@/lib/scrape/json-ld";

/** Below this much text, a page with no structured data is probably JavaScript-rendered. */
export const MIN_TEXT_CHARS = 500;

export type PageMeta = {
  title: string | null;
  siteName: string | null;
  description: string | null;
};

export type PageContent = {
  meta: PageMeta;
  structured: StructuredHints | null;
  text: string;
  textTruncated: boolean;
  /** True when there is too little to extract from (suggest pasting the text). */
  isThin: boolean;
};

function clean(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed === "" ? null : trimmed;
}

export function readPage(html: string): PageContent {
  const $ = load(html);

  // Read metadata and JSON-LD before extractMainText removes <head> scripts and chrome.
  const meta: PageMeta = {
    title:
      clean($('meta[property="og:title"]').attr("content")) ?? clean($("title").first().text()),
    siteName: clean($('meta[property="og:site_name"]').attr("content")),
    description:
      clean($('meta[name="description"]').attr("content")) ??
      clean($('meta[property="og:description"]').attr("content")),
  };
  const structured = extractJsonLd($);
  const { text, truncated } = extractMainText($);

  return {
    meta,
    structured,
    text,
    textTruncated: truncated,
    isThin: text.length < MIN_TEXT_CHARS && structured === null,
  };
}
