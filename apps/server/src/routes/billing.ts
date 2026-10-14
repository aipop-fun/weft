import type { Database } from "bun:sqlite";
import {
  loadBillingFromEnv, isBillingReady, createCheckout, verifyStripeSignature, planFromEvent,
} from "@weft/billing";

const cfg = loadBillingFromEnv();

function json(v: unknown, status = 200): Response {
  return new Response(JSON.stringify(v, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleBilling(
  req: Request,
  url: URL,
  db: Database,
): Promise<Response | null> {
  if (url.pathname === "/api/billing/checkout" && req.method === "POST") {
    if (!isBillingReady(cfg)) return json({ error: "Stripe não configurado" }, 503);
    const body = (await req.json()) as { plan: any; orgSlug: string; email: string };
    try {
      const u = await createCheckout(cfg, body);
      return json({ url: u });
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }

  if (url.pathname === "/api/billing/webhook" && req.method === "POST") {
    const raw = await req.text();
    const sig = req.headers.get("stripe-signature") ?? "";
    if (!verifyStripeSignature(raw, sig, cfg.webhookSecret)) {
      return json({ error: "assinatura inválida" }, 401);
    }
    const ev = JSON.parse(raw);
    const update = planFromEvent(ev);
    if (update) {
      db.query(`UPDATE orgs SET plan = ? WHERE slug = ?`).run(update.plan, update.orgSlug);
      db.query(`INSERT INTO audit (actor, action, details) VALUES (?, ?, ?)`)
        .run("stripe:webhook", `billing:${ev.type}`, JSON.stringify({ org: update.orgSlug, plan: update.plan }));
    }
    return json({ received: true });
  }

  if (url.pathname === "/api/billing/status" && req.method === "GET") {
    const orgSlug = url.searchParams.get("org");
    if (!orgSlug) return json({ error: "parâmetro 'org' obrigatório" }, 400);
    const org = db.query(`SELECT plan FROM orgs WHERE slug = ?`).get(orgSlug) as { plan: string } | null;
    if (!org) return json({ error: "org não encontrada" }, 404);
    return json({ org: orgSlug, plan: org.plan });
  }

  return null;
}
