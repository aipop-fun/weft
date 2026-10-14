import type { Database } from "bun:sqlite";
import { recordFeedback, stats, exportTrainingPairs, toJSONL, type FeedbackEvent } from "@weft/feedback";

function json(v: unknown, status = 200): Response {
  return new Response(JSON.stringify(v, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleFeedback(
  req: Request,
  url: URL,
  db: Database,
): Promise<Response | null> {
  if (url.pathname === "/api/feedback" && req.method === "POST") {
    const body = (await req.json()) as FeedbackEvent;
    if (!body.pr_id || !body.kind) {
      return json({ error: "campos 'pr_id' e 'kind' obrigatórios" }, 400);
    }
    recordFeedback(db, body);
    return json({ ok: true });
  }

  if (url.pathname === "/api/feedback/stats" && req.method === "GET") {
    const orgId = url.searchParams.get("org_id");
    return json(stats(db, orgId ? Number(orgId) : undefined));
  }

  // export em JSONL para fine-tune (protegido por token interno)
  if (url.pathname === "/api/feedback/export" && req.method === "GET") {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!process.env.WEFT_INTERNAL_TOKEN || token !== process.env.WEFT_INTERNAL_TOKEN) {
      return json({ error: "não autorizado" }, 401);
    }
    const source = url.searchParams.get("source") ?? undefined;
    const rows = exportTrainingPairs(db, source);
    return new Response(toJSONL(rows), {
      headers: {
        "content-type": "application/x-ndjson",
        "content-disposition": `attachment; filename="weft-training-${Date.now()}.jsonl"`,
      },
    });
  }

  return null;
}
