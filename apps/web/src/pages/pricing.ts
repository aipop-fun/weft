import { translator, type Locale } from "@weft/i18n";
import { renderHead, renderJsonLd } from "../seo";

interface Plan {
  id: string;
  priceKey: string;
  ctaKey: string;
  ctaHref: string;
  highlight?: boolean;
  features: string[];
}

function plans(locale: Locale): Plan[] {
  const pt = locale === "pt-BR";
  return [
    {
      id: "free",
      priceKey: "plan.free.price",
      ctaKey: "pricing.cta.free",
      ctaHref: "https://github.com/apps/weft",
      features: pt
        ? ["Repositórios públicos ilimitados", "5 devs em repos privados", "Regras por diretório", "Modo observação", "Comunidade no Discord"]
        : ["Unlimited public repos", "5 devs on private repos", "Per-directory rules", "Observation mode", "Discord community"],
    },
    {
      id: "team",
      priceKey: "plan.team.price",
      ctaKey: "pricing.cta.team",
      ctaHref: "mailto:comercial@weft.dev?subject=Plano%20Team",
      highlight: true,
      features: pt
        ? ["Repos privados ilimitados", "Devs ilimitados", "SSO Google", "Regras customizadas", "Templates SOC2 / HIPAA / PCI", "Suporte por email (48h)"]
        : ["Unlimited private repos", "Unlimited devs", "Google SSO", "Custom rules", "SOC2 / HIPAA / PCI templates", "Email support (48h)"],
    },
    {
      id: "business",
      priceKey: "plan.business.price",
      ctaKey: "pricing.cta.business",
      ctaHref: "mailto:comercial@weft.dev?subject=Plano%20Business",
      features: pt
        ? ["Tudo do Team", "Audit export (CSV/JSON)", "Retenção configurável", "RBAC por diretório", "SLA 99.9%", "Suporte prioritário (12h)"]
        : ["Everything in Team", "Audit export (CSV/JSON)", "Configurable retention", "Per-directory RBAC", "99.9% SLA", "Priority support (12h)"],
    },
    {
      id: "enterprise",
      priceKey: "plan.enterprise.price",
      ctaKey: "pricing.cta.enterprise",
      ctaHref: "mailto:comercial@weft.dev?subject=Enterprise",
      features: pt
        ? ["Tudo do Business", "Self-hosted (Docker/Helm)", "On-prem ou VPC dedicada", "DPA e contrato customizado", "TAM dedicado", "SOC2 report próprio"]
        : ["Everything in Business", "Self-hosted (Docker/Helm)", "On-prem or dedicated VPC", "DPA and custom contract", "Dedicated TAM", "Our own SOC2 report"],
    },
  ];
}

export function renderPricing(locale: Locale): string {
  const tr = translator(locale);
  const ps = plans(locale);

  const meta = {
    title: `${tr("pricing.title")} — Weft`,
    description: tr("pricing.lead"),
    path: locale === "en" ? "/en/precos" : "/precos",
    keywords: ["weft pricing", "code review pricing", "preço code review"],
  };

  const cards = ps.map((p) => `
    <div class="plan ${p.highlight ? "plan-highlight" : ""}">
      ${p.highlight ? `<span class="badge">${locale === "pt-BR" ? "Mais popular" : "Most popular"}</span>` : ""}
      <h3>${tr(`plan.${p.id}`)}</h3>
      <p class="tag">${tr(`plan.${p.id}.tag`)}</p>
      <div class="price">
        <span class="amount">${tr(p.priceKey)}</span>
        ${p.id !== "free" && p.id !== "enterprise" ? `<span class="period">${tr("pricing.monthly")}</span>` : ""}
      </div>
      <a class="cta ${p.highlight ? "cta-primary" : "cta-secondary"}" href="${p.ctaHref}">${tr(p.ctaKey)}</a>
      <ul>
        ${p.features.map((f) => `<li>${f}</li>`).join("")}
      </ul>
    </div>
  `).join("");

  const faqs = [
    ["faq.q1", "faq.a1"],
    ["faq.q2", "faq.a2"],
    ["faq.q3", "faq.a3"],
    ["faq.q4", "faq.a4"],
    ["faq.q5", "faq.a5"],
  ];

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${renderHead(meta)}
${renderJsonLd(meta)}
<style>
:root{--bg:#0a0a0b;--fg:#e5e5e7;--mut:#a1a1aa;--acc:#7dd3fc;--ok:#86efac;--border:#26262a;--panel:#131316}
*{box-sizing:border-box;margin:0;padding:0}
body{font:16px/1.6 system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.nav{padding:20px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(10,10,11,0.85);backdrop-filter:blur(12px);z-index:100}
.brand{font-weight:700;font-size:20px;letter-spacing:-.02em}
.nav nav{display:flex;gap:24px;align-items:center;font-size:14px}
.nav nav a{color:var(--mut)}
.nav nav a:hover{color:var(--fg)}
.lang{display:flex;gap:8px;font-size:12px}
.lang a{padding:4px 8px;border-radius:6px}
.lang a.active{background:var(--panel);color:var(--fg)}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px}
header.page{padding:80px 0 48px;text-align:center;max-width:720px;margin:0 auto}
header.page h1{font-size:clamp(32px,5vw,52px);letter-spacing:-.03em;font-weight:700;margin-bottom:20px}
header.page p{font-size:20px;color:var(--mut)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;margin:40px 0 80px}
.plan{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:32px 28px;position:relative;display:flex;flex-direction:column}
.plan-highlight{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc),0 8px 32px rgba(125,211,252,.08)}
.badge{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--acc);color:#0a0a0b;padding:4px 12px;border-radius:99px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.plan h3{font-size:22px;margin-bottom:6px}
.tag{color:var(--mut);font-size:14px;margin-bottom:24px;min-height:42px}
.price{margin-bottom:24px}
.amount{font-size:40px;font-weight:700;letter-spacing:-.02em}
.period{color:var(--mut);font-size:14px;margin-left:6px}
.cta{display:block;padding:14px 24px;border-radius:10px;font-weight:600;text-align:center;margin-bottom:24px;transition:opacity .15s,transform .15s}
.cta:hover{opacity:.9;transform:translateY(-1px)}
.cta-primary{background:var(--acc);color:#0a0a0b}
.cta-secondary{background:#1a1a1e;border:1px solid var(--border);color:var(--fg)}
.plan ul{list-style:none;padding:0;margin-top:auto}
.plan li{padding:8px 0;color:#d4d4d8;font-size:14px;border-bottom:1px solid #1a1a1e;display:flex;gap:10px;align-items:flex-start}
.plan li:last-child{border-bottom:none}
.plan li::before{content:"✓";color:var(--ok);font-weight:700;flex-shrink:0}
.faq{padding:60px 0;border-top:1px solid var(--border)}
.faq h2{font-size:28px;margin-bottom:32px;text-align:center}
details{border-bottom:1px solid var(--border);padding:20px 0;max-width:720px;margin:0 auto}
summary{cursor:pointer;font-weight:600;font-size:16px;list-style:none}
summary::-webkit-details-marker{display:none}
summary::before{content:"＋ ";color:var(--acc);margin-right:8px}
details[open] summary::before{content:"− "}
details p{color:var(--mut);margin-top:12px;padding-left:24px;font-size:15px}
footer{border-top:1px solid var(--border);padding:48px 24px;text-align:center;color:var(--mut);font-size:14px}
@media(max-width:640px){.nav{padding:16px}.nav nav a:not(.cta-small){display:none}.grid{gap:16px}}
</style>
</head>
<body>
<header class="nav">
  <a href="${locale === "en" ? "/en" : "/"}" class="brand">weft</a>
  <nav>
    <a href="/para/oss">${tr("nav.oss")}</a>
    <a href="/para/fintech">${tr("nav.fintech")}</a>
    <a href="/para/monorepo">${tr("nav.monorepo")}</a>
    <a href="${locale === "en" ? "/en/precos" : "/precos"}">${tr("nav.pricing")}</a>
    <a href="/docs">${tr("nav.docs")}</a>
    <a href="/demo" style="padding:8px 16px;background:var(--acc);color:#0a0a0b;border-radius:8px;font-weight:600">${tr("nav.demo")}</a>
    <span class="lang">
      <a href="?lang=pt" class="${locale === "pt-BR" ? "active" : ""}">PT</a>
      <a href="?lang=en" class="${locale === "en" ? "active" : ""}">EN</a>
    </span>
  </nav>
</header>

<div class="wrap">
  <header class="page">
    <h1>${tr("pricing.title")}</h1>
    <p>${tr("pricing.lead")}</p>
  </header>

  <div class="grid">
    ${cards}
  </div>

  <section class="faq">
    <h2>${tr("pricing.faq")}</h2>
    ${faqs.map(([q, a]) => `<details><summary>${tr(q)}</summary><p>${tr(a)}</p></details>`).join("")}
  </section>
</div>

<footer>${tr("footer.license")} © 2026</footer>
</body>
</html>`;
}
