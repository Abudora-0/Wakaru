import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, fetchText } from "./http";
import { ProviderError } from "../types";

/**
 * Every outbound provider call funnels through here, and the chain above
 * decides whether to fall through or give up based purely on the error kind
 * this module assigns. Getting a classification wrong does not surface as an
 * error, it surfaces as the chain retrying something it should have benched,
 * or benching something that was only briefly unavailable.
 */

afterEach(() => vi.unstubAllGlobals());

function respondWith(init: { status?: number; body?: unknown; text?: string }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const status = init.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
          if (init.text !== undefined) throw new SyntaxError("not JSON");
          return init.body;
        },
        text: async () => init.text ?? JSON.stringify(init.body),
      } as unknown as Response;
    }),
  );
}

/** A request that never settles until its signal is aborted. */
function respondNever() {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    ),
  );
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "no error";
  } catch (error) {
    return error instanceof ProviderError ? error.kind : "not a ProviderError";
  }
}

describe("fetchJson", () => {
  it("returns the parsed body on success", async () => {
    respondWith({ body: { hello: "world" } });
    await expect(fetchJson<{ hello: string }>("https://x.test", { provider: "p" })).resolves.toEqual({
      hello: "world",
    });
  });

  it("classifies 429 as a rate limit, which is retryable later", async () => {
    respondWith({ status: 429 });
    const error = await fetchJson("https://x.test", { provider: "p" }).catch((e: unknown) => e);

    expect((error as ProviderError).kind).toBe("rate_limit");
    expect((error as ProviderError).retryable).toBe(true);
    expect((error as ProviderError).status).toBe(429);
  });

  it("classifies 404 as not found, which is not worth retrying", async () => {
    respondWith({ status: 404 });
    const error = await fetchJson("https://x.test", { provider: "p" }).catch((e: unknown) => e);

    expect((error as ProviderError).kind).toBe("not_found");
    expect((error as ProviderError).retryable).toBe(false);
  });

  it("classifies any other failing status as a bad response", async () => {
    respondWith({ status: 500 });
    expect(await kindOf(fetchJson("https://x.test", { provider: "p" }))).toBe("bad_response");
  });

  it("classifies a body that is not JSON as a bad response", async () => {
    respondWith({ text: "<html>an error page</html>" });
    expect(await kindOf(fetchJson("https://x.test", { provider: "p" }))).toBe("bad_response");
  });

  it("classifies a transport failure as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("failed to fetch"); }));
    expect(await kindOf(fetchJson("https://x.test", { provider: "p" }))).toBe("network");
  });

  it("gives up on a hanging request and calls it a timeout", async () => {
    respondNever();
    expect(await kindOf(fetchJson("https://x.test", { provider: "p", timeoutMs: 20 }))).toBe("timeout");
  });

  it("names the provider in the message, so a chain failure is traceable", async () => {
    respondWith({ status: 500 });
    const error = await fetchJson("https://x.test", { provider: "mymemory" }).catch((e: unknown) => e);

    expect((error as ProviderError).provider).toBe("mymemory");
    expect((error as ProviderError).message).toContain("[mymemory]");
  });

  it("sends a JSON body and content type when one is given", async () => {
    const spy = vi.fn(async (_url: string, _options?: RequestInit) =>
      ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response);
    vi.stubGlobal("fetch", spy);

    await fetchJson("https://x.test", { provider: "p", method: "POST", body: { q: "hello" } });

    const [, options] = spy.mock.calls[0] ?? [];
    const headers = (options?.headers ?? {}) as Record<string, string>;

    expect(options?.method).toBe("POST");
    expect(options?.body).toBe('{"q":"hello"}');
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("does not set a content type when there is no body", async () => {
    const spy = vi.fn(async (_url: string, _options?: RequestInit) =>
      ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response);
    vi.stubGlobal("fetch", spy);

    await fetchJson("https://x.test", { provider: "p" });

    const [, options] = spy.mock.calls[0] ?? [];
    const headers = (options?.headers ?? {}) as Record<string, string>;

    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("propagates a caller abort rather than treating it as a timeout", async () => {
    respondNever();
    const controller = new AbortController();
    const pending = fetchJson("https://x.test", { provider: "p", signal: controller.signal, timeoutMs: 5_000 });

    controller.abort();

    // The caller cancelled, so this is not the provider being slow.
    expect(await kindOf(pending)).toBe("network");
  });
});

describe("fetchText", () => {
  it("returns the raw body, for endpoints that do not answer with JSON", async () => {
    respondWith({ text: '[[["hola","hello",null,null,10]]]' });
    await expect(fetchText("https://x.test", { provider: "p" })).resolves.toContain("hola");
  });

  it("classifies a rate limit the same way as the JSON path", async () => {
    respondWith({ status: 429, text: "slow down" });
    expect(await kindOf(fetchText("https://x.test", { provider: "p" }))).toBe("rate_limit");
  });

  it("gives up on a hanging request", async () => {
    respondNever();
    expect(await kindOf(fetchText("https://x.test", { provider: "p", timeoutMs: 20 }))).toBe("timeout");
  });
});
