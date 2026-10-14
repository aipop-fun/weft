import { openDB, upsertInstall, setInstallToken, getInstall, upsertRepo, audit } from "@weft/db";
import { migrateOrgs } from "@weft/db/orgs";
import { loadConfigFromEnv, isGitHubConfigured, installationToken, verifyWebhook, GitHub } from "@weft/github";
import { loadLLMFromEnv } from "@weft/llm";
import { reviewPullRequest } from "@weft/review";
import { chain, cors, rateLimit, csrf, requireAuth, requireOrg, injectCsrf, type Ctx } from "@weft/middleware";

const cfg = loadConfigFromEnv();
const llm = loadLLMFromEnv();
const { db } = openDB();
migrateOrgs(db);
const githubReady = isGitHubConfigured(cfg);
const port = Number(process.env.PORT ?? 3000);

async function tokenFor(installationId: number): Promise<string> {
  const cached = getInstall(db, installationId);
  if (cached?.access_token && cached.token_expires_at && cached.token_expires_at > Date.now() + 60_000) {
    return cached.access_token;
  }
  const { token, expiresAt } = await installationToken(cfg, installationId);
  if (cached) setInstallToken(db, cached.id, token, expiresAt);
  return token;
}

function json(v: unknown, status = 200): Response {
  return new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
}

async function handleWebhook(req: Request): Promise<Response> {
  if (!githubReady) return json({ error: "GitHub App não configurado" }, 503);
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  if (!verifyWebhook(cfg.webhookSecret, raw, sig)) return new Response("invalid signature", { status: 401 });

  const event = req.headers.get("x-github-event") ?? "";
  const payload = JSON.parse(raw);
  const installationId: number = payload.installation?.id;

  if (payload.installation) {
    upsertInstall(db, {
      github_installation_id: payload.installation.id,
      account_login: payload.installation.account.login,
      account_type: payload.installation.account.type,
      access_token: null, token_expires_at: null,
    });
  }

  if (event === "installation" || event === "installation_repositories") {
    const install = getInstall(db, installationId);
    if (!install) return json({ ok: false });
    const repos = payload.repositories ?? payload.repositories_added ?? [];
    for (const r of repos) {
      upsertRepo(db, {
        install_id: install.id, github_repo_id: r.id,
        owner: r.owner.login, name: r.name, full_name: r.full_name,
      });
    }
    audit(db, { actor: `github:${payload.installation.account.login}`, action: `installation.${event}` });
    return json({ ok: true, repos: repos.length });
  }

  if (event === "pull_request") {
    if (!["opened", "synchronize", "reopened", "ready_for_review"].includes(payload.action)) {
      return json({ ok: true });
    }
    if (payload.pull_request.draft) return json({ ok: true, skipped: "draft" });
    queueMicrotask(async () => {
      try {
        const token = await tokenFor(installationId);
        const gh = new GitHub(token, cfg.apiBase);
        await reviewPullRequest({
          db, github: gh, llm,
          owner: payload.repository.owner.login, repo: payload.repository.name,
          prNumber: payload.pull_request.number, prTitle: payload.pull_request.title,
          prBody: payload.pull_request.body ?? "", prAuthor: payload.pull_request.user.login,
          headSha: payload.pull_request.head.sha, baseSha: payload.pull_request.base.sha,
        });
      } catch (e) { console.error("review:", e); }
    });
    return json({ ok: true });
  }
  return json({ ok: true, ignored: event });
}

async function handleAPI(ctx: Ctx): Promise<Response> {
  const { url, req } = ctx;
  const orgId = ctx.org?.id;

  if (url.pathname === "/health") {
    return json({ ok: true, version: "0.1.0", github: githubReady ? "configured" : "off", llm: llm.provider });
  }

  if (url.pathname === "/api/stats") {
    const stats = db.query(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN decision = 'approve' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN decision = 'request_human' THEN 1 ELSE 0 END) AS escalated,
        SUM(CASE WHEN decision = 'observed' THEN 1 ELSE 0 END) AS observed,
        AVG(latency_ms) AS avg_latency
      FROM classifications c
      JOIN pull_requests p ON p.id = c.pr_id
      JOIN repos r ON r.id = p.repo_id
      WHERE r.org_id = ? OR r.org_id IS NULL
    `).get(orgId);
    return json(stats);
  }

  if (url.pathname === "/api/recent") {
    const recent = db.query(`
      SELECT c.*, p.number, p.title, p.author, r.full_name AS repo
      FROM classifications c
      JOIN pull_requests p ON p.id = c.pr_id
      JOIN repos r ON r.id = p.repo_id
      WHERE r.org_id = ? OR r.org_id IS NULL
      ORDER BY c.id DESC LIMIT 50
    `).all(orgId);
    return json(recent);
  }

  if (url.pathname === "/api/rules" && req.method === "GET") {
    const repo = url.searchParams.get("repo");
    if (!repo) return json([]);
    const rows = db.query(`
      SELECT * FROM rules WHERE repo_id IN (
        SELECT id FROM repos WHERE full_name = ? AND (org_id = ? OR org_id IS NULL)
      )
    `).all(repo, orgId);
    return json(rows);
  }

  if (url.pathname === "/api/rules" && req.method === "POST") {
    const b = await req.json() as any;
    const r = db.query(`SELECT id FROM repos WHERE full_name = ? AND (org_id = ? OR org_id IS NULL)`).get(b.repo, orgId) as { id: number } | null;
    if (!r) return json({ error: "repo não encontrado" }, 404);
    const { upsertRule } = await import("@weft/db");
    upsertRule(db, {
      repo_id: r.id, path_prefix: b.path_prefix,
      required_human: b.required_human ?? 1,
      block_auto: b.block_auto ? 1 : 0,
      auto_approve_trivial: b.auto_approve_trivial ? 1 : 0,
    });
    return json({ ok: true });
  }

  if (url.pathname === "/api/audit" && req.method === "GET") {
    const rows = db.query(`
      SELECT a.*, r.full_name AS repo
      FROM audit a LEFT JOIN repos r ON r.id = a.repo_id
      WHERE r.org_id = ? OR r.org_id IS NULL
      ORDER BY a.id DESC LIMIT 500
    `).all(orgId);
    return json(rows);
  }

  if (url.pathname === "/api/verticals" && req.method === "GET") {
    const { ALL } = await import("@weft/rules/verticals");
    return json(ALL.map((t) => ({ id: t.id, name: t.name, description: t.description, rules: t.rules.length })));
  }

  if (url.pathname.startsWith("/api/verticals/") && req.method === "POST") {
    const id = url.pathname.slice("/api/verticals/".length);
    const { byId } = await import("@weft/rules/verticals");
    const tpl = byId(id);
    if (!tpl) return json({ error: "template não encontrado" }, 404);
    const b = await req.json() as any;
    const r = db.query(`SELECT id FROM repos WHERE full_name = ? AND (org_id = ? OR org_id IS NULL)`).get(b.repo, orgId) as { id: number } | null;
    if (!r) return json({ error: "repo não encontrado" }, 404);
    const { upsertRule } = await import("@weft/db");
    for (const rule of tpl.rules) upsertRule(db, { repo_id: r.id, ...rule });
    return json({ ok: true, applied: tpl.rules.length });
  }

  if (url.pathname === "/api/feedback" && req.method === "POST") {
    const b = await req.json() as any;
    const { recordFeedback, migrateFeedback } = await import("@weft/feedback");
    migrateFeedback(db);
    recordFeedback(db, { ...b, org_id: orgId });
    return json({ ok: true });
  }

  if (url.pathname === "/api/audit/export") {
    const { queryAudit, toCSV } = await import("@weft/audit");
    const rows = queryAudit(db, { orgId });
    return new Response(toCSV(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="weft-audit-${Date.now()}.csv"`,
      },
    });
  }

  const { handleAuth } = await import("./routes/auth");
  const authRes = await handleAuth(req, url, db);
  if (authRes) return authRes;

  return json({ error: "not found" }, 404);
}

const handler = chain(
  cors(),
  requireAuth(db),
  requireOrg(db),
  injectCsrf(),
  csrf(),
  rateLimit({ key: (ctx) => `user:${ctx.user?.id ?? ctx.ip}`, perSecond: 20, burst: 60 }),
  async (ctx) => {
    if (ctx.url.pathname === "/webhook") return handleWebhook(ctx.req);
    return handleAPI(ctx);
  },
);

Bun.serve({
  port,
  idleTimeout: 240,
  async fetch(req, srv) {
    const url = new URL(req.url);
    const ip = srv.requestIP(req)?.address ?? "local";
    const setCookies: string[] = [];
    const ctx: Ctx = {
      req, url, ip, csrf: "", headers: {},
      setCookie: (c) => setCookies.push(c),
    };
    const res = await handler(ctx);
    const h = new Headers(res.headers);
    for (const c of setCookies) h.append("set-cookie", c);
    return new Response(res.body, { status: res.status, headers: h });
  },
});

console.log(`weft-server :${port}`);
console.log(`  github    ${githubReady ? "configurado" : "não configurado"}`);
console.log(`  llm       ${llm.provider} · ${llm.model}`);
console.log(`  cors      ${process.env.CORS_ORIGINS ?? "http://localhost:3001"}`);
