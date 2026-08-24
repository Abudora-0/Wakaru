import { ProviderError } from "../types.js";

export interface FetchJsonOptions {
  provider: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: unknown;
}

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * A single place where every outbound provider call happens.
 *
 * Providers are free, unmetered and occasionally unreliable, so the timeout is
 * short and every failure mode is turned into a typed ProviderError. The chain
 * above relies on those kinds to decide whether to fall through to the next
 * provider or to give up.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const { provider, timeoutMs = DEFAULT_TIMEOUT_MS, signal, headers, method = "GET", body } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Honour an upstream cancellation, for example the user typing a new query.
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new ProviderError(provider, "timeout", `no response within ${timeoutMs}ms`);
    }
    throw new ProviderError(provider, "network", err instanceof Error ? err.message : "request failed");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  if (response.status === 429) {
    throw new ProviderError(provider, "rate_limit", "daily or burst quota exhausted", 429);
  }
  if (response.status === 404) {
    throw new ProviderError(provider, "not_found", "no entry for that query", 404);
  }
  if (!response.ok) {
    throw new ProviderError(provider, "bad_response", `HTTP ${response.status}`, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ProviderError(provider, "bad_response", "response was not valid JSON");
  }
}

/**
 * Some free endpoints answer with text rather than JSON, and one of them
 * answers with JavaScript-ish array soup, so raw text is available too.
 */
export async function fetchText(url: string, options: FetchJsonOptions): Promise<string> {
  const { provider, timeoutMs = DEFAULT_TIMEOUT_MS, signal, headers } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/plain, */*", ...headers },
    });
    if (response.status === 429) {
      throw new ProviderError(provider, "rate_limit", "quota exhausted", 429);
    }
    if (!response.ok) {
      throw new ProviderError(provider, "bad_response", `HTTP ${response.status}`, response.status);
    }
    return await response.text();
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (controller.signal.aborted && !signal?.aborted) {
      throw new ProviderError(provider, "timeout", `no response within ${timeoutMs}ms`);
    }
    throw new ProviderError(provider, "network", err instanceof Error ? err.message : "request failed");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
