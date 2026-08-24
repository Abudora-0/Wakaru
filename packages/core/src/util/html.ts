/**
 * Wiktionary is the only multilingual dictionary source that is free, keyless
 * and covers most of the world, but its REST endpoint hands back MediaWiki
 * HTML fragments rather than plain text. Those fragments carry inline
 * TemplateStyles blocks, transclusion wrappers and citation markup that must
 * not reach the interface.
 *
 * This runs in Node and in the browser, so it cannot rely on DOMParser.
 */

/** Elements whose contents are markup rather than prose and must go entirely. */
const DROP_WITH_CONTENT = /<(style|script|sup|table)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Self closing or unclosed style blocks that MediaWiki sometimes emits. */
const DROP_ORPHAN_STYLE = /<style\b[^>]*\/?>/gi;

const TAG = /<\/?[a-z][^>]*>/gi;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "-",
  "&mdash;": ", ",
  "&hellip;": "...",
  "&laquo;": '"',
  "&raquo;": '"',
  "&lsquo;": "'",
  "&rsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
};

function decodeEntities(input: string): string {
  let out = input;
  for (const [entity, char] of Object.entries(ENTITIES)) {
    out = out.split(entity).join(char);
  }
  // Numeric entities, both decimal and hexadecimal.
  out = out.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
  return out;
}

/**
 * Turn a MediaWiki HTML fragment into clean single line prose.
 * Returns an empty string when nothing survives, which the caller treats as
 * "this sense had no usable definition" rather than as an error.
 */
export function stripWikiHtml(html: string): string {
  if (!html) return "";

  let text = html;
  text = text.replace(DROP_WITH_CONTENT, " ");
  text = text.replace(DROP_ORPHAN_STYLE, " ");
  text = text.replace(TAG, "");
  text = decodeEntities(text);

  // MediaWiki leaves bracketed reference and edit markers behind.
  text = text.replace(/\[\s*(edit|citation needed|\d+)\s*\]/gi, "");

  // Collapse all whitespace, including the newlines inside transcluded blocks.
  text = text.replace(/\s+/g, " ").trim();

  // Definitions frequently start with a stray separator once markup is gone.
  text = text.replace(/^[\s:;,.\-]+/, "").trim();

  return text;
}

/**
 * Wiktionary marks the headword inside examples with bold tags. Callers want
 * the plain sentence, but knowing which token was highlighted is useful for
 * the interface, so both are returned.
 */
export function extractExample(html: string): { text: string; highlight?: string } {
  const boldMatch = /<b\b[^>]*>([\s\S]*?)<\/b>/i.exec(html);
  const highlight = boldMatch ? stripWikiHtml(boldMatch[1] ?? "") : undefined;
  const text = stripWikiHtml(html);
  return highlight ? { text, highlight } : { text };
}

/** Guard against a provider handing back an entire error page as a definition. */
export function looksLikeProse(text: string, maxLen = 600): boolean {
  if (!text) return false;
  if (text.length > maxLen) return false;
  if (/^https?:\/\//i.test(text)) return false;
  return true;
}
