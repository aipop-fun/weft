// Billing via Stripe Checkout, sem SDK. Cria sessão, escuta webhook, atualiza org.plan.

export interface BillingConfig {
  secretKey: string;
  webhookSecret: string;
  prices: Record<string, string>; // plan → price_id
  successURL: string;
  cancelURL: string;
}

export function loadBillingFromEnv(): BillingConfig {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    prices: {
      team: process.env.STRIPE_PRICE_TEAM ?? "",
      business: process.env.STRIPE_PRICE_BUSINESS ?? "",
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
    },
    successURL: process.env.STRIPE_SUCCESS_URL ?? "http://localhost:3001/dashboard?billing=ok",
    cancelURL: process.env.STRIPE_CANCEL_URL ?? "http://localhost:3001/precos?billing=cancel",
  };
}

export function isBillingReady(cfg: BillingConfig): boolean {
  return !!cfg.secretKey;
}

export async function createCheckout(
  cfg: BillingConfig,
  opts: { plan: "team" | "business" | "enterprise"; orgSlug: string; email: string },
): Promise<string> {
  const priceId = cfg.prices[opts.plan];
  if (!priceId) throw new Error(`price_id não configurado para plano ${opts.plan}`);

  const params = new URLSearchParams({
    "mode": "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "success_url": cfg.successURL,
    "cancel_url": cfg.cancelURL,
    "customer_email": opts.email,
    "client_reference_id": opts.orgSlug,
    "metadata[org]": opts.orgSlug,
    "metadata[plan]": opts.plan,
  });

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!r.ok) throw new Error(`stripe checkout: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { url: string };
  return j.url;
}

// ---------- webhook (verificação HMAC SHA256) ----------
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSec = 300,
): boolean {
  if (!secret) return false;
  const parts = header.split(",").reduce((acc, kv) => {
    const [k, v] = kv.split("=");
    if (k && v) acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  if (v1.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, any> };
}

export function planFromEvent(ev: StripeEvent): { orgSlug: string; plan: string } | null {
  const obj = ev.data.object;
  if (ev.type === "checkout.session.completed") {
    const org = obj.metadata?.org ?? obj.client_reference_id;
    const plan = obj.metadata?.plan ?? "team";
    if (org) return { orgSlug: org, plan };
  }
  if (ev.type === "customer.subscription.deleted") {
    const org = obj.metadata?.org;
    if (org) return { orgSlug: org, plan: "free" };
  }
  if (ev.type === "customer.subscription.updated") {
    const org = obj.metadata?.org;
    const plan = obj.metadata?.plan;
    if (org && plan) return { orgSlug: org, plan };
  }
  return null;
}
