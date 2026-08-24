import { NextResponse } from "next/server";
import { ProviderError } from "@wakaru/core";
import { CACHE_HEADERS, NO_CACHE_HEADERS, getTranslateChain } from "@/lib/providers";

/** Refuse very long input rather than burning a daily budget on one request. */
const MAX_CHARS = 5_000;

interface Body {
  text?: unknown;
  from?: unknown;
  to?: unknown;
  dialect?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const text = asString(body.text);
  const from = asString(body.from) ?? "auto";
  const to = asString(body.to);
  const dialect = asString(body.dialect);

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400, headers: NO_CACHE_HEADERS });
  }
  if (!to) {
    return NextResponse.json({ error: "to is required" }, { status: 400, headers: NO_CACHE_HEADERS });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `text is ${text.length} characters, the limit is ${MAX_CHARS}` },
      { status: 413, headers: NO_CACHE_HEADERS },
    );
  }

  try {
    const result = await getTranslateChain().translate({
      text,
      from,
      to,
      ...(dialect ? { targetDialect: dialect } : {}),
    });

    return NextResponse.json(result, {
      headers: {
        ...CACHE_HEADERS,
        // Useful when debugging which provider answered and whether it fell back.
        "X-Wakaru-Provider": result.provider,
        "X-Wakaru-Cached": String(result.cached),
      },
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      const status = error.kind === "rate_limit" ? 429 : error.kind === "unsupported" ? 400 : 502;
      return NextResponse.json(
        { error: error.message, kind: error.kind, retryable: error.retryable },
        { status, headers: NO_CACHE_HEADERS },
      );
    }
    return NextResponse.json({ error: "translation failed" }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
