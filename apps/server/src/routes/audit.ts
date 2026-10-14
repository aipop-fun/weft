import type { Database } from "bun:sqlite";
import { queryAudit, toCSV, toJSON, verifyChain } from "@weft/audit";

export async function handleAudit(
  req: Request,
  url: URL,
  db: Database,
): Promise<Response | null> {
  if (url.pathname === "/api/audit" && req.method === "GET") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const repo = url.searchParams.get("repo") ?? undefined;
    const rows = queryAudit(db, {
      from: from ? Number(from) : undefined,
      to: to ? Number(to) : undefined,
      repo,
    });
    return new Response(JSON.stringify(rows, null, 2), {
      headers: { "content-type": "application/json" },
    });
  }

  if (url.pathname === "/api/audit/export" && req.method === "GET") {
    const format = url.searchParams.get("format") ?? "csv";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const repo = url.searchParams.get("repo") ?? undefined;
    const rows = queryAudit(db, {
      from: from ? Number(from) : undefined,
      to: to ? Number(to) : undefined,
      repo,
    });

    const ts = new Date().toISOString().split("T")[0];

    if (format === "csv") {
      return new Response(toCSV(rows), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="weft-audit-${ts}.csv"`,
        },
      });
    }
    if (format === "json") {
      return new Response(toJSON(rows), {
        headers: {
          "content-type": "application/json",
          "content-disposition": `attachment; filename="weft-audit-${ts}.json"`,
        },
      });
    }
    return new Response("formato inválido — use csv ou json", { status: 400 });
  }

  if (url.pathname === "/api/audit/verify" && req.method === "GET") {
    return new Response(JSON.stringify(verifyChain(db), null, 2), {
      headers: { "content-type": "application/json" },
    });
  }

  return null;
}
