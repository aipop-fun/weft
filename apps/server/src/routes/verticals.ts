import { byId, ALL } from "@weft/rules/verticals";
import { getRepoByFullName, upsertRule, audit } from "@weft/db";
import type { Database } from "bun:sqlite";

function json(v: unknown, status = 200): Response {
  return new Response(JSON.stringify(v, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleVerticals(
  req: Request,
  url: URL,
  db: Database,
): Promise<Response | null> {
  if (url.pathname === "/api/verticals" && req.method === "GET") {
    return json(
      ALL.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        rules: t.rules.length,
      })),
    );
  }

  if (url.pathname.startsWith("/api/verticals/") && req.method === "POST") {
    const id = url.pathname.slice("/api/verticals/".length);
    const tpl = byId(id);
    if (!tpl) return json({ error: `template '${id}' não encontrado` }, 404);

    const body = (await req.json()) as { repo?: string };
    if (!body.repo) return json({ error: "campo 'repo' obrigatório" }, 400);

    const repo = getRepoByFullName(db, body.repo);
    if (!repo) return json({ error: `repo '${body.repo}' não registrado` }, 404);

    let applied = 0;
    for (const r of tpl.rules) {
      upsertRule(db, {
        repo_id: repo.id,
        path_prefix: r.path_prefix,
        required_human: r.required_human,
        block_auto: r.block_auto,
        auto_approve_trivial: r.auto_approve_trivial,
      });
      applied++;
    }
    audit(db, {
      repo_id: repo.id,
      actor: "api:vertical",
      action: `apply:${id}`,
      details: `${applied} regras aplicadas`,
    });

    return json({ ok: true, template: id, rules_applied: applied, repo: body.repo });
  }

  return null;
}
