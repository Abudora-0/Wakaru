import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Lru } from "./lru";

/**
 * The cache is not an optimisation here, it is the thing that keeps a 5,000
 * character daily budget usable by more than one visitor. A silent eviction
 * bug would show up as mysterious quota exhaustion in production, so the
 * eviction and expiry rules are pinned down.
 */

describe("Lru", () => {
  it("stores and returns a value", () => {
    const cache = new Lru<string>();
    cache.set("a", "one");
    expect(cache.get("a")).toBe("one");
    expect(cache.size).toBe(1);
  });

  it("returns undefined for a key it never saw", () => {
    expect(new Lru<string>().get("nothing")).toBeUndefined();
  });

  it("evicts the least recently used key when it is full", () => {
    const cache = new Lru<string>(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.set("d", "4");

    expect(cache.size).toBe(3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("d")).toBe("4");
  });

  it("counts a read as a use, so a hot key survives eviction", () => {
    const cache = new Lru<string>(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");

    // Touching "a" should move it to the back of the eviction queue, which is
    // the entire point of the structure and is easy to get wrong.
    cache.get("a");
    cache.set("d", "4");

    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
  });

  it("overwrites a key without growing", () => {
    const cache = new Lru<string>(2);
    cache.set("a", "first");
    cache.set("a", "second");

    expect(cache.size).toBe(1);
    expect(cache.get("a")).toBe("second");
  });

  it("moves a rewritten key to the most recent position", () => {
    const cache = new Lru<string>(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("a", "1 again");
    cache.set("c", "3");

    expect(cache.get("a")).toBe("1 again");
    expect(cache.get("b")).toBeUndefined();
  });

  it("clears everything", () => {
    const cache = new Lru<string>();
    cache.set("a", "1");
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  describe("expiry", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("returns a value that is still inside its lifetime", () => {
      const cache = new Lru<string>(10, 1000);
      cache.set("a", "1");
      vi.advanceTimersByTime(900);
      expect(cache.get("a")).toBe("1");
    });

    it("drops a value once its lifetime has passed", () => {
      const cache = new Lru<string>(10, 1000);
      cache.set("a", "1");
      vi.advanceTimersByTime(1001);
      expect(cache.get("a")).toBeUndefined();
    });

    it("frees the slot when an expired key is read", () => {
      const cache = new Lru<string>(10, 1000);
      cache.set("a", "1");
      vi.advanceTimersByTime(1001);
      cache.get("a");
      expect(cache.size).toBe(0);
    });

    it("reports has() as false for an expired key", () => {
      const cache = new Lru<string>(10, 1000);
      cache.set("a", "1");
      expect(cache.has("a")).toBe(true);
      vi.advanceTimersByTime(1001);
      expect(cache.has("a")).toBe(false);
    });

    it("restarts the lifetime when a key is written again", () => {
      const cache = new Lru<string>(10, 1000);
      cache.set("a", "1");
      vi.advanceTimersByTime(900);
      cache.set("a", "2");
      vi.advanceTimersByTime(900);

      // Without the reset this read would land past the original expiry.
      expect(cache.get("a")).toBe("2");
    });
  });
});
