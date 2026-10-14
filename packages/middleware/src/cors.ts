import type { Middleware } from "./ctx";

const ALLOWED = (process.env.CORS_ORIGINS ?? "http://localhost:3001")
  .split(",").map((s) => s.trim()).filter(Boolean);

export function cors(): Middleware {
  return async (ctx, next) => {
    const origin = ctx.req.headers.get("origin") ?? "";
    const allowed = origin && ALLOWED.includes(origin);

    if (allowed) {
      ctx.headers["access-control-allow-origin"] = origin;
      ctx.headers["access-control-allow-credentials"] = "true";
      ctx.headers["vary"] = "Origin";
    }
    if (ctx.req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...ctx.headers,
          "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type,authorization,x-csrf-token,x-weft-org",
          "access-control-max-age": "86400",
        },
      });
    }
    const res = await next();
    if (!allowed) return res;
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(ctx.headers)) h.set(k, v);
    return new Response(res.body, { status: res.status, headers: h });
  };
}
