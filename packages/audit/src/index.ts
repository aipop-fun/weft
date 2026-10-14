import type { Database } from "bun:sqlite";

export interface AuditRow {
  id: number;
  at: number;
  actor: string;
  action: string;
  repo: string | null;
  pr_number: number | null;
  details: string | null;
  intent: string | null;
  decision: string | null;
  model: string | null;
}

export function queryAudit(db: Database, opts: {
  orgId?: number;
  from?: number;
  to?: number;
  repo?: string;
  limit?: number;
}): AuditRow[] {
  const where: string[] = [];
  const params: any[] = [];
  if (opts.orgId != null) { where.push("a.org_id = ?"); params.push(opts.orgId); }
  if (opts.from) { where.push("a.created_at >= ?"); params.push(opts.from); }
  if (opts.to) { where.push("a.created_at <= ?"); params.push(opts.to); }
  if (opts.repo) { where.push("r.full_name = ?"); params.push(opts.repo); }

  const sql = `
    SELECT
      a.id, a.created_at AS at, a.actor, a.action,
      r.full_name AS repo, a.pr_number, a.details,
      c.intent, c.decision, c.model
    FROM audit a
    LEFT JOIN repos r ON r.id = a.repo_id
    LEFT JOIN pull_requests p ON p.repo_id = r.id AND p.number = a.pr_number
    LEFT JOIN classifications c ON c.pr_id = p.id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY a.created_at DESC
    LIMIT ?
  `;
  params.push(opts.limit ?? 10000);
  return db.query(sql).all(...params) as AuditRow[];
}

export function toCSV(rows: AuditRow[]): string {
  const cols = ["id", "at_iso", "actor", "action", "repo", "pr_number", "intent", "decision", "model", "details"];
  const lines = [cols.join(",")];
  for (const r of rows) {
    lines.push([
      r.id,
      new Date(r.at * 1000).toISOString(),
      csvEscape(r.actor),
      csvEscape(r.action),
      csvEscape(r.repo ?? ""),
      r.pr_number ?? "",
      r.intent ?? "",
      r.decision ?? "",
      csvEscape(r.model ?? ""),
      csvEscape(r.details ?? ""),
    ].join(","));
  }
  return lines.join("\n");
}

export function toJSON(rows: AuditRow[]): string {
  return JSON.stringify(rows.map((r) => ({
    ...r,
    at_iso: new Date(r.at * 1000).toISOString(),
  })), null, 2);
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- verificação de integridade ----------
export function verifyChain(db: Database, orgId?: number): { ok: boolean; total: number; broken: number } {
  const rows = db.query(`
    SELECT id, created_at FROM audit
    ${orgId != null ? "WHERE org_id = ?" : ""}
    ORDER BY id
  `).all(...(orgId != null ? [orgId] : [])) as Array<{ id: number; created_at: number }>;

  let broken = 0;
  for (let i = 1; i < rows.length; i++) {
    // se um id é menor e o timestamp é maior, houve manipulação
    if (rows[i].id < rows[i - 1].id) broken++;
    if (rows[i].created_at < rows[i - 1].created_at) broken++;
  }
  return { ok: broken === 0, total: rows.length, broken };
}
