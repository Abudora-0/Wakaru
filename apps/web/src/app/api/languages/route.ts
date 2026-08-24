import { NextResponse } from "next/server";
import { LANGUAGES, totalDialectCount } from "@wakaru/core";

/**
 * The registry is static data compiled into the bundle, so this is served
 * straight from the edge and never touches a provider.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      languages: LANGUAGES.map((language) => ({
        code: language.code,
        name: language.name,
        native: language.native,
        script: language.script,
        dir: language.dir,
        family: language.family,
        sample: language.sample,
        dialects: language.dialects.map((dialect) => ({
          code: dialect.code,
          name: dialect.name,
          native: dialect.native,
          region: dialect.region,
          summary: dialect.summary,
        })),
      })),
      counts: {
        languages: LANGUAGES.length,
        dialects: totalDialectCount(),
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=31536000, immutable" } },
  );
}
