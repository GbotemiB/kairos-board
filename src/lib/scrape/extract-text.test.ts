// @vitest-environment node
import { load } from "cheerio";
import { describe, expect, it } from "vitest";

import { MAX_TEXT_CHARS, extractMainText } from "@/lib/scrape/extract-text";

function textOf(html: string, maxChars?: number) {
  return extractMainText(load(html), maxChars);
}

describe("extractMainText", () => {
  it("prefers <main> over the rest of the page", () => {
    const { text } = textOf("<body><div>Outside</div><main><p>Inside main</p></main></body>");

    expect(text).toBe("Inside main");
  });

  it("uses [role=main] when there is no <main>", () => {
    const { text } = textOf('<body><div>Outside</div><div role="main">Role main</div></body>');

    expect(text).toBe("Role main");
  });

  it("falls back to the longest <article>", () => {
    const { text } = textOf(
      "<body><article>Short</article><article>This article is clearly longer</article></body>",
    );

    expect(text).toBe("This article is clearly longer");
  });

  it("falls back to <body>", () => {
    expect(textOf("<body><p>Just body</p></body>").text).toBe("Just body");
  });

  it.each([
    ["script", "<script>var x = 1;</script>"],
    ["style", "<style>p { color: red }</style>"],
    ["noscript", "<noscript>Enable JS</noscript>"],
    ["nav", "<nav>Home About</nav>"],
    ["header", "<header>Site header</header>"],
    ["footer", "<footer>Copyright</footer>"],
    ["aside", "<aside>Sidebar</aside>"],
    ["form", "<form>Search</form>"],
    ["cookie banner", '<div class="CookieBanner">Accept cookies</div>'],
    ["consent dialog", '<div id="consent-modal">Consent</div>'],
    ["aria-hidden", '<div aria-hidden="true">Hidden</div>'],
    ["hidden", "<div hidden>Hidden</div>"],
    ["navigation role", '<div role="navigation">Menu</div>'],
  ])("removes %s", (_name, noise) => {
    expect(textOf(`<body>${noise}<p>Content</p></body>`).text).toBe("Content");
  });

  it("keeps block boundaries as separate lines", () => {
    const { text } = textOf(
      "<main><h1>Title</h1><p>First paragraph.</p><ul><li>One</li><li>Two</li></ul><p>A<br>B</p></main>",
    );

    expect(text).toBe("Title\nFirst paragraph.\nOne\nTwo\nA\nB");
  });

  it("collapses whitespace, non-breaking spaces and empty lines", () => {
    const { text } = textOf(
      "<main><p>  Lots   of\n\n  space&nbsp;&nbsp;here  </p><p>   </p><p>End</p></main>",
    );

    expect(text).toBe("Lots of space here\nEnd");
  });

  it("decodes HTML entities", () => {
    expect(textOf("<main><p>Master&#39;s &amp; PhD &mdash; 2027</p></main>").text).toBe(
      "Master's & PhD — 2027",
    );
  });

  it(`truncates to ${MAX_TEXT_CHARS} characters by default`, () => {
    const { text, truncated } = textOf(`<main><p>${"a".repeat(MAX_TEXT_CHARS + 500)}</p></main>`);

    expect(text).toHaveLength(MAX_TEXT_CHARS);
    expect(truncated).toBe(true);
  });

  it("does not flag text within the limit as truncated", () => {
    expect(textOf("<main><p>short</p></main>", 10)).toEqual({ text: "short", truncated: false });
  });

  it("returns empty text for an empty page", () => {
    expect(textOf("<html><body></body></html>")).toEqual({ text: "", truncated: false });
  });
});

describe("extractMainText source formatting", () => {
  it("treats newlines inside a paragraph as spaces, like a browser", () => {
    const html = `<main>
      <p>
        A paragraph wrapped
        across several source lines.
      </p>
      <p>Next</p>
    </main>`;

    expect(extractMainText(load(html)).text).toBe(
      "A paragraph wrapped across several source lines.\nNext",
    );
  });
});
