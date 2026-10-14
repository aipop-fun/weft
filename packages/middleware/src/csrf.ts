import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Middleware } from "./ctx";

const SECRET = process.env.CSRF_SECRET ?? randomBytes(32).toString("hex");

export function issueToken(sessionId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", SECRET).update(`${sessionId}:${nonce}`).digest("hex");
  return `${nonce}.${sig}`;
}

export function verifyToken(sessionId: string, token: string): boolean {
  const [nonce, sig] = token.split(".");
  if (!nonce || !sig) return false;
  const expected = createHmac("sha256", SECRET).update(`${sessionId}:${nonce}`).digest("hex");
  if (sig.length !== expected.length) return false;
  try { return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")); } catch { return false; }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrf(): Middleware {
  return async (ctx, next) => {
    if (SAFE_METHODS.has(ctx.req.method)) return next();
    // webhooks têm HMAC próprio, não CSRF
    if (ctx.url.pathname === "/webhook") return next();
    // login/callback são redirects do Google
    if (ctx.url.pathname.startsWith("/auth/")) return next();

    const header = ctx.req.headers.get("x-csrf-token") ?? "";
    const session = ctx.session ?? "";
    if (!session || !verifyToken(session, header)) {
      return new Response(JSON.stringify({ error: "csrf inválido" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    return next();
  };
}
