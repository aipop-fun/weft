import type { Database } from "bun:sqlite";
import {
  loadGoogleFromEnv, isGoogleReady, authURL, exchangeCode,
} from "@weft/auth";
import {
  upsertUser, createOrg, getUserOrgs, createSession, getSession, destroySession,
} from "@weft/db/orgs";

const cfg = loadGoogleFromEnv();
const stateMap = new Map<string, number>();

function json(v: unknown, status = 200): Response {
  return new Response(JSON.stringify(v, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function cookie(token: string, ttlSec = 30 * 86400): string {
  return `weft_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttlSec}`;
}

function cookieClear(): string {
  return `weft_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function handleAuth(
  req: Request,
  url: URL,
  db: Database,
): Promise<Response | null> {
  // ---------- iniciar login ----------
  if (url.pathname === "/auth/google" && req.method === "GET") {
    if (!isGoogleReady(cfg)) {
      return json({ error: "Google OAuth não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET." }, 503);
    }
    const state = crypto.randomUUID();
    stateMap.set(state, Date.now() + 5 * 60_000);
    return Response.redirect(authURL(cfg, state), 302);
  }

  // ---------- callback ----------
  if (url.pathname === "/auth/google/callback" && req.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") ?? "";
    const exp = stateMap.get(state);
    stateMap.delete(state);
    if (!code || !exp || exp < Date.now()) {
      return json({ error: "state inválido ou expirado" }, 400);
    }
    try {
      const gu = await exchangeCode(cfg, code);
      const user = upsertUser(db, {
        email: gu.email,
        name: gu.name,
        provider: "google",
        provider_id: gu.sub,
      });

      // cria org pessoal se não existir
      const orgs = getUserOrgs(db, user.id);
      if (!orgs.length) {
        const slug = gu.email.split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-");
        createOrg(db, slug, gu.name || slug, user.id);
      }

      const token = createSession(db, user.id);
      return new Response(null, {
        status: 302,
        headers: { location: "/dashboard", "set-cookie": cookie(token) },
      });
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }
  }

  // ---------- quem sou eu ----------
  if (url.pathname === "/auth/me" && req.method === "GET") {
    const tok = parseCookie(req.headers.get("cookie") ?? "");
    if (!tok) return json({ authenticated: false }, 401);
    const user = getSession(db, tok);
    if (!user) return json({ authenticated: false }, 401);
    const orgs = getUserOrgs(db, user.id);
    return json({ authenticated: true, user, orgs });
  }

  // ---------- logout ----------
  if (url.pathname === "/auth/logout" && req.method === "POST") {
    const tok = parseCookie(req.headers.get("cookie") ?? "");
    if (tok) destroySession(db, tok);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json", "set-cookie": cookieClear() },
    });
  }

  return null;
}

function parseCookie(raw: string): string | null {
  for (const part of raw.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === "weft_session") return v ?? null;
  }
  return null;
}
