import { describe, expect, it } from "vitest";
import { escapeRegExp, extractExample, looksLikeProse, stripWikiHtml } from "./html";

/**
 * Wiktionary hands back MediaWiki HTML, not text, and it is the least
 * predictable input in the project: templates, transclusion wrappers, inline
 * TemplateStyles and citation markup all arrive inside what is nominally a
 * definition. The fixtures below are shapes taken from real responses.
 */

describe("stripWikiHtml", () => {
  it("keeps the text and drops the link markup", () => {
    const input = '<a rel="mw:WikiLink" href="/wiki/water" title="water">water</a>';
    expect(stripWikiHtml(input)).toBe("water");
  });

  it("removes a TemplateStyles block along with its contents", () => {
    // This is the failure that matters. Stripping tags but keeping their text
    // would put a CSS rule in the middle of a definition, which is exactly
    // what Wiktionary returns for a large share of entries.
    const input =
      '<style data-mw-deduplicate="TemplateStyles:r90144991" typeof="mw:Extension/templatestyles">' +
      ".mw-parser-output .defdate{font-size:smaller}</style> a " +
      '<a rel="mw:WikiLink" href="/wiki/cat" title="cat">cat</a>';

    const result = stripWikiHtml(input);
    expect(result).toBe("a cat");
    expect(result).not.toContain("font-size");
    expect(result).not.toContain("mw-parser-output");
  });

  it("removes a script block along with its contents", () => {
    expect(stripWikiHtml("before <script>alert(1)</script> after")).toBe("before after");
  });

  it("removes reference superscripts and tables entirely", () => {
    expect(stripWikiHtml("a word<sup>[1]</sup> here")).toBe("a word here");
    expect(stripWikiHtml("text <table><tr><td>junk</td></tr></table> more")).toBe("text more");
  });

  it("survives an unclosed style tag", () => {
    expect(stripWikiHtml('<style data-mw-deduplicate="x" />the definition')).toBe("the definition");
  });

  it("decodes named and numeric entities", () => {
    expect(stripWikiHtml("salt &amp; pepper")).toBe("salt & pepper");
    expect(stripWikiHtml("&lt;not a tag&gt;")).toBe("<not a tag>");
    expect(stripWikiHtml("caf&#233;")).toBe("café");
    expect(stripWikiHtml("caf&#xe9;")).toBe("café");
    expect(stripWikiHtml("a&nbsp;b")).toBe("a b");
  });

  it("collapses the whitespace transclusion leaves behind", () => {
    expect(stripWikiHtml("one\n\n   two\t\tthree")).toBe("one two three");
  });

  it("trims the separator left over once markup is gone", () => {
    expect(stripWikiHtml("<i></i>: to run quickly")).toBe("to run quickly");
    expect(stripWikiHtml("  ,  a definition")).toBe("a definition");
  });

  it("strips bracketed edit and citation markers", () => {
    expect(stripWikiHtml("a definition [citation needed]")).toBe("a definition");
    expect(stripWikiHtml("a definition [edit]")).toBe("a definition");
  });

  it("returns an empty string when nothing survives", () => {
    expect(stripWikiHtml("<style>.x{color:red}</style>")).toBe("");
    expect(stripWikiHtml("")).toBe("");
  });

  it("leaves plain text alone", () => {
    expect(stripWikiHtml("a simple definition")).toBe("a simple definition");
  });

  it("does not mangle non Latin scripts", () => {
    expect(stripWikiHtml("<b>猫</b>という動物")).toBe("猫という動物");
    expect(stripWikiHtml("<i>کتاب</i>")).toBe("کتاب");
  });
});

describe("extractExample", () => {
  it("returns the sentence and the highlighted headword", () => {
    const result = extractExample("Va venir l'<b>agua</b>");
    expect(result.text).toBe("Va venir l'agua");
    expect(result.highlight).toBe("agua");
  });

  it("omits the highlight when the example has no bold run", () => {
    const result = extractExample("a plain example sentence");
    expect(result.text).toBe("a plain example sentence");
    expect(result.highlight).toBeUndefined();
  });

  it("cleans markup inside the highlight too", () => {
    const result = extractExample('the <b><i>cat</i></b> sat');
    expect(result.text).toBe("the cat sat");
    expect(result.highlight).toBe("cat");
  });
});

describe("looksLikeProse", () => {
  it("accepts an ordinary definition", () => {
    expect(looksLikeProse("a small domesticated carnivore")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(looksLikeProse("")).toBe(false);
  });

  it("rejects a bare URL, which is what a broken entry usually yields", () => {
    expect(looksLikeProse("https://example.com/some/page")).toBe(false);
  });

  it("rejects anything long enough to be a whole page", () => {
    expect(looksLikeProse("x".repeat(601))).toBe(false);
    expect(looksLikeProse("x".repeat(599))).toBe(true);
  });
});

describe("escapeRegExp", () => {
  // Asserted behaviourally rather than by comparing escaped strings, because
  // the point is that the result matches literally.
  it("makes regex metacharacters match themselves", () => {
    for (const term of ["a.b", "c++", "who?", "(paren)", "[bracket]", "a|b", "^start", "end$", "a*b"]) {
      const pattern = new RegExp(escapeRegExp(term));
      expect(pattern.test(term)).toBe(true);
    }
  });

  it("stops a metacharacter from matching something it should not", () => {
    // Unescaped, "a.b" would match "axb". Escaped, it must not.
    expect(new RegExp(escapeRegExp("a.b")).test("axb")).toBe(false);
  });

  it("leaves ordinary text unchanged", () => {
    expect(escapeRegExp("computadora")).toBe("computadora");
  });
});
