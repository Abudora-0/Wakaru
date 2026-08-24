/**
 * A very small LRU with time to live.
 *
 * Every free provider here has a daily budget, so caching is not an
 * optimisation, it is what makes the site usable by more than one person. This
 * runs in the Next route handlers in front of the CDN cache, and in the
 * extension service worker where there is no CDN at all.
 */
export class Lru<V> {
  private readonly max: number;
  private readonly ttlMs: number;
  private readonly store = new Map<string, { value: V; expires: number }>();

  constructor(max = 500, ttlMs = 1000 * 60 * 60 * 12) {
    this.max = max;
    this.ttlMs = ttlMs;
  }

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;

    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    // Reinsert so the most recently used key sits at the end of the map.
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });

    while (this.store.size > this.max) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
