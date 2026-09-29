import type { CheerioAPI } from "cheerio";

/** Characters of page text sent onwards (to the AI). */
export const MAX_TEXT_CHARS = 20_000;

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "iframe",
  "canvas",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "[role=navigation]",
  "[role=banner]",
  "[role=contentinfo]",
  "[role=dialog]",
  "[aria-hidden=true]",
  "[hidden]",
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="consent" i]',
  '[class*="consent" i]',
].join(",");

const BLOCK_SELECTORS =
  "p,div,section,article,main,li,ul,ol,h1,h2,h3,h4,h5,h6,tr,td,th,dd,dt,dl,blockquote,pre,table";

/** Private-use character: never whitespace, never in real page text. */
const BLOCK_BREAK = "\uE000";

export type MainText = { text: string; truncated: boolean };

/**
 * Extracts readable text from the main content area, with page chrome
 * (navigation, footers, cookie banners, scripts) removed. Mutates `$`.
 */
export function extractMainText($: CheerioAPI, maxChars = MAX_TEXT_CHARS): MainText {
  $(NOISE_SELECTORS).remove();

  const main = $("main, [role=main]").first();
  const articles = $("article")
    .toArray()
    .sort((a, b) => $(b).text().length - $(a).text().length);
  const root = main.length > 0 ? main : articles.length > 0 ? $(articles[0]) : $("body");

  // Mark block boundaries with a sentinel, then collapse whitespace like a browser
  // does (source newlines inside a paragraph are just spaces).
  root.find("br").replaceWith(BLOCK_BREAK);
  root.find(BLOCK_SELECTORS).each((_, element) => {
    $(element).append(BLOCK_BREAK);
  });

  const text = root
    .text()
    .replace(/\s+/g, " ")
    .split(BLOCK_BREAK)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");

  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxChars), truncated: true };
}
