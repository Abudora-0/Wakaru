import { NextResponse } from "next/server";
import { getTranslateChain } from "@/lib/providers";
import { NO_CACHE_HEADERS } from "@/lib/providers";

/**
 * Which providers are configured, which are benched and why.
 *
 * Every provider here is free and therefore occasionally down, so the state of
 * the chain is something an operator should be able to read at a glance rather
 * than infer from failed translations.
 */
export async function GET(): Promise<NextResponse> {
  const providers = getTranslateChain().report();

  return NextResponse.json(
    {
      ok: providers.some((provider) => provider.ready && !provider.benched),
      providers,
      selfHosted: Boolean(process.env.LIBRETRANSLATE_URL),
    },
    { headers: NO_CACHE_HEADERS },
  );
}
