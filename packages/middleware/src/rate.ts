import type { Middleware } from "./ctx";

interface Bucket { tokens: number; capacity: number; rate: number; last: number }
const buckets = new Map<string, Bucket>();

export function rateLimit(opts: { key: (ctx: any) => string; perSecond: number; burst: number }): Middleware {
  return async (ctx, next) => {
    const k = opts.key(ctx);
    const now = Date.now();
    let b = buckets.get(k);
    if (!b) { b = { tokens: opts.burst, capacity: opts.burst, rate: opts.perSecond, last: now }; buckets.set(k, b); }
    b.tokens = Math.min(b.capacity, b.tokens + ((now - b.last) / 1000) * b.rate);
    b.last = now;
    if (b.tokens < 1) {
      return new Response(JSON.stringify({ error: "rate limit" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "1" },
      });
    }
    b.tokens--;
    return next();
  };
}
