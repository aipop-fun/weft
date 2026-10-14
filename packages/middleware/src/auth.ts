import type { Middleware } from "./ctx";
import { getSession } from "@weft/db/orgs";
import type { Database } from "bun:sqlite";

const PUBLIC = [
  /^\/health$/,
  /^\/webhook$/,
  /^\/auth\//,
  /^\/_fuzz$/,
];

export function requireAuth(db: Database): Middleware {
  return async (ctx, next) => {
    if (PUBLIC.some((r) => r.test(ctx.url.pathname))) return next();

    const cookie = ctx.req.headers.get("cookie") ?? "";
    const token = parseCookie(cookie, "weft_session");
    if (!token) {
      return new Response(JSON.stringify({ error: "não autenticado" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    const user = getSession(db, token);
    if (!user) {
      return new Response(JSON.stringify({ error: "sessão expirada" }), {
        status: 401,
        headers: { "content-type": "application/json", "set-cookie": clearCookie() },
      });
    }
    ctx.user = user;
    ctx.session = token;

    // rotação: se a sessão tem mais de 24h, renova
    const row = db.query(`SELECT created_at FROM sessions WHERE token = ?`).get(token) as { created_at: number } | null;
    if (row && Date.now() / 1000 - row.created_at > 86400) {
      const { createSession, destroySession } = await import("@weft/db/orgs");
      destroySession(db, token);
      const newTok = createSession(db, user.id);
      ctx.session = newTok;
      ctx.setCookie(`weft_session=${newTok}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
    }

    return next();
  };
}

export function requireOrg(db: Database): Middleware {
  return async (ctx, next) => {
    if (PUBLIC.some((r) => r.test(ctx.url.pathname))) return next();
    // rotas que não precisam de org
    if (ctx.url.pathname === "/auth/me" || ctx.url.pathname === "/auth/logout") return next();

    const slug = ctx.url.searchParams.get("org") ?? ctx.req.headers.get("x-weft-org");
    if (!slug) {
      // tenta pegar a primeira org do usuário
      const { getUserOrgs } = await import("@weft/db/orgs");
      const orgs = getUserOrgs(db, ctx.user!.id);
      if (!orgs.length) {
        return new Response(JSON.stringify({ error: "usuário sem org" }), { status: 403, headers: { "content-type": "application/json" } });
      }
      ctx.org = orgs[0];
      return next();
    }

    const { getUserOrgs } = await import("@weft/db/orgs");
    const orgs = getUserOrgs(db, ctx.user!.id);
    const match = orgs.find((o) => o.slug === slug);
    if (!match) {
      return new Response(JSON.stringify({ error: "sem acesso a essa org" }), { status: 403, headers: { "content-type": "application/json" } });
    }
    ctx.org = match;
    return next();
  };
}

export function injectCsrf(): Middleware {
  return async (ctx, next) => {
    const { issueToken } = await import("./csrf");
    ctx.csrf = ctx.session ? issueToken(ctx.session) : "";
    const res = await next();
    const h = new Headers(res.headers);
    if (ctx.csrf) h.set("x-csrf-token", ctx.csrf);
    return new Response(res.body, { status: res.status, headers: h });
  };
}

function parseCookie(raw: string, name: string): string | null {
  for (const part of raw.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === name) return v ?? null;
  }
  return null;
}

function clearCookie(): string {
  return "weft_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}
