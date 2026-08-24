import { NextResponse } from "next/server";
import { ProviderError } from "@wakaru/core";
import { CACHE_HEADERS, NO_CACHE_HEADERS, getDictionaryChain } from "@/lib/providers";

interface Params {
  params: Promise<{ lang: string; word: string }>;
}

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const { lang, word } = await params;
  const term = decodeURIComponent(word).trim();

  if (!term) {
    return NextResponse.json({ error: "word is required" }, { status: 400, headers: NO_CACHE_HEADERS });
  }
  if (term.length > 80) {
    return NextResponse.json({ error: "that is a phrase, not a word" }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  try {
    const entry = await getDictionaryChain().lookup(term, lang);

    if (!entry) {
      return NextResponse.json(
        { error: "no entry found", word: term, lang },
        // A miss is still cacheable, briefly, so a typo is not looked up
        // repeatedly against the upstream sources.
        { status: 404, headers: { "Cache-Control": "public, s-maxage=600" } },
      );
    }

    return NextResponse.json(entry, {
      headers: { ...CACHE_HEADERS, "X-Wakaru-Sources": entry.sources.join(",") },
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return NextResponse.json({ error: error.message, kind: error.kind }, { status: 502, headers: NO_CACHE_HEADERS });
    }
    return NextResponse.json({ error: "lookup failed" }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
