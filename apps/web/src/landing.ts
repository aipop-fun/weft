import { renderHead, renderJsonLd, type PageMeta } from "./seo";

const NAV = `
<header class="nav">
  <a href="/" class="brand">weft</a>
  <nav>
    <a href="/para/oss">Open Source</a>
    <a href="/para/fintech">Fintech</a>
    <a href="/para/monorepo">Monorepos</a>
    <a href="/precos">Preços</a>
    <a href="/docs">Docs</a>
    <a href="/demo" class="cta-small">Testar</a>
  </nav>
</header>`;

const STYLES = `
:root{--bg:#0a0a0b;--fg:#e5e5e7;--mut:#a1a1aa;--acc:#7dd3fc;--ok:#86efac;--warn:#fcd34d;--bad:#fca5a5;--panel:#131316;--border:#26262a;--radius:12px}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--fg);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{max-width:100%;height:auto}
.nav{padding:20px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(10,10,11,0.85);backdrop-filter:blur(12px);z-index:100}
.brand{font-weight:700;font-size:20px;letter-spacing:-0.02em}
.nav nav{display:flex;gap:24px;align-items:center;font-size:14px}
.nav nav a{color:var(--mut)}
.nav nav a:hover{color:var(--fg)}
.cta-small{padding:8px 16px;background:var(--acc);color:#0a0a0b!important;border-radius:8px;font-weight:600}
main{max-width:1100px;margin:0 auto;padding:0 24px}
.hero{padding:100px 0 80px;text-align:center;max-width:840px;margin:0 auto}
.hero h1{font-size:clamp(36px,6vw,64px);line-height:1.05;letter-spacing:-0.03em;font-weight:700;margin-bottom:24px}
.hero h1 em{color:var(--acc);font-style:normal}
.hero .lead{font-size:clamp(18px,2.2vw,22px);color:var(--mut);max-width:660px;margin:0 auto 40px}
.hero .actions{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
.btn{padding:16px 32px;border-radius:10px;font-weight:600;font-size:16px;transition:transform .12s ease,opacity .12s ease}
.btn:hover{transform:translateY(-1px);opacity:.92}
.btn-primary{background:var(--acc);color:#0a0a0b}
.btn-secondary{background:var(--panel);border:1px solid var(--border);color:var(--fg)}
.trust{padding:32px 0;text-align:center;color:var(--mut);font-size:14px}
.trust .logos{display:flex;gap:32px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:20px;font-family:ui-monospace,monospace;opacity:.6}
section{padding:80px 0;border-top:1px solid var(--border)}
section h2{font-size:clamp(28px,4vw,40px);letter-spacing:-0.02em;margin-bottom:16px}
section .lead{color:var(--mut);font-size:18px;max-width:640px;margin-bottom:48px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:28px}
.card h3{font-size:18px;margin-bottom:8px}
.card p{color:var(--mut);font-size:15px}
.card .num{color:var(--acc);font-family:ui-monospace,monospace;font-size:13px;margin-bottom:12px;display:block}
.steps{counter-reset:step}
.step{display:flex;gap:20px;padding:24px 0;border-bottom:1px solid var(--border)}
.step:last-child{border-bottom:none}
.step .n{flex-shrink:0;width:40px;height:40px;background:var(--panel);border:1px solid var(--border);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:ui-monospace,monospace;color:var(--acc);font-size:14px}
.step .txt h3{font-size:16px;margin-bottom:4px}
.step .txt p{color:var(--mut);font-size:14px}
.demo-box{background:#0a0a0b;border:1px solid var(--border);border-radius:var(--radius);padding:24px;font-family:ui-monospace,monospace;font-size:13px;line-height:1.7;overflow-x:auto}
.demo-box .ok{color:var(--ok)}
.demo-box .warn{color:var(--warn)}
.demo-box .bad{color:var(--bad)}
.demo-box .mut{color:var(--mut)}
.faq details{border-bottom:1px solid var(--border);padding:20px 0}
.faq summary{cursor:pointer;font-weight:600;font-size:16px;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::before{content:"＋ ";color:var(--acc);margin-right:8px;font-family:ui-monospace,monospace}
.faq details[open] summary::before{content:"− "}
.faq p{color:var(--mut);margin-top:12px;font-size:15px;padding-left:24px}
.cta-final{text-align:center;padding:100px 0}
.cta-final h2{margin-bottom:16px}
footer{border-top:1px solid var(--border);padding:48px 24px;text-align:center;color:var(--mut);font-size:14px}
footer .cols{display:flex;gap:48px;justify-content:center;flex-wrap:wrap;margin-bottom:32px;text-align:left}
footer .col h4{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--fg);margin-bottom:12px}
footer .col a{display:block;color:var(--mut);padding:4px 0;font-size:13px}
footer .col a:hover{color:var(--fg)}
@media(max-width:640px){.nav{padding:16px}.nav nav{gap:12px;font-size:13px}.nav nav a:not(.cta-small){display:none}.hero{padding:60px 0 40px}}
`;

export interface LandingContent {
  meta: PageMeta;
  h1: string;
  lead: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  sections: Section[];
}

export interface Section {
  title: string;
  lead?: string;
  kind: "cards" | "steps" | "demo" | "faq" | "cta";
  items?: Array<{ n?: string; title?: string; body: string }>;
  demo?: string;
  cta?: { label: string; href: string; title: string };
}

export function renderLanding(c: LandingContent): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${renderHead(c.meta)}
${renderJsonLd(c.meta)}
<style>${STYLES}</style>
</head>
<body>
${NAV}
<main>
  <section class="hero">
    <h1>${c.h1}</h1>
    <p class="lead">${c.lead}</p>
    <div class="actions">
      <a class="btn btn-primary" href="${c.primaryCta.href}">${c.primaryCta.label}</a>
      ${c.secondaryCta ? `<a class="btn btn-secondary" href="${c.secondaryCta.href}">${c.secondaryCta.label}</a>` : ""}
    </div>
  </section>
  ${c.sections.map(renderSection).join("\n")}
</main>
<footer>
  <div class="cols">
    <div class="col"><h4>Produto</h4><a href="/demo">Demo</a><a href="/precos">Preços</a><a href="/docs">Documentação</a></div>
    <div class="col"><h4>Verticais</h4><a href="/para/oss">Open Source</a><a href="/para/fintech">Fintech</a><a href="/para/monorepo">Monorepos</a><a href="/para/compliance">Compliance</a></div>
    <div class="col"><h4>Recursos</h4><a href="/blog/adversarial-review">Adversarial review</a><a href="/blog/regra-dura">Regra dura por path</a></div>
    <div class="col"><h4>Empresa</h4><a href="https://github.com/weftdev/weft">GitHub</a><a href="/privacidade">Privacidade</a><a href="/termos">Termos</a></div>
  </div>
  <p>Weft é open source (MIT). © 2026 Weft contributors.</p>
</footer>
</body>
</html>`;
}

function renderSection(s: Section): string {
  if (s.kind === "cards") {
    return `<section>
  <h2>${s.title}</h2>
  ${s.lead ? `<p class="lead">${s.lead}</p>` : ""}
  <div class="grid">
    ${(s.items ?? []).map((i) => `<div class="card">${i.n ? `<span class="num">${i.n}</span>` : ""}<h3>${i.title}</h3><p>${i.body}</p></div>`).join("")}
  </div>
</section>`;
  }
  if (s.kind === "steps") {
    return `<section>
  <h2>${s.title}</h2>
  ${s.lead ? `<p class="lead">${s.lead}</p>` : ""}
  <div class="steps">
    ${(s.items ?? []).map((i) => `<div class="step"><div class="n">${i.n}</div><div class="txt"><h3>${i.title}</h3><p>${i.body}</p></div></div>`).join("")}
  </div>
</section>`;
  }
  if (s.kind === "demo") {
    return `<section>
  <h2>${s.title}</h2>
  ${s.lead ? `<p class="lead">${s.lead}</p>` : ""}
  <div class="demo-box">${s.demo}</div>
</section>`;
  }
  if (s.kind === "faq") {
    return `<section class="faq">
  <h2>${s.title}</h2>
  ${(s.items ?? []).map((i) => `<details><summary>${i.title}</summary><p>${i.body}</p></details>`).join("")}
</section>`;
  }
  if (s.kind === "cta") {
    return `<section class="cta-final">
  <h2>${s.cta?.title}</h2>
  <div class="actions"><a class="btn btn-primary" href="${s.cta?.href}">${s.cta?.label}</a></div>
</section>`;
  }
  return "";
}

export const HOME: LandingContent = {
  meta: {
    title: "Weft — Review de PR em piloto automático para times de engenharia",
    description: "Reduza 80% do tempo de revisão de PR sem perder controle. O Weft classifica cada mudança, aprova o trivial, escala o sensível, e mantém trilha de auditoria completa. Open source, self-hosted, regras por diretório.",
    path: "/",
    keywords: ["code review automation", "PR review", "AI code review", "auditoria de código", "SOC2 code compliance", "monorepo", "devops", "engenharia de software"],
  },
  h1: "Seu time revisa <em>1 PR em cada 10</em>. O Weft cuida dos outros 9.",
  lead: "Classificamos cada mudança, aprovamos o trivial, escalamos o sensível — com trilha de auditoria que seu compliance aprova. Sem substituir o Git, o GitHub, ou o CI.",
  primaryCta: { label: "Testar com um PR público", href: "/demo" },
  secondaryCta: { label: "Ver no GitHub", href: "https://github.com/weftdev/weft" },
  sections: [
    {
      title: "O problema real",
      lead: "Engenheiros gastam 6 horas por semana revisando PRs. A maioria é dependabot, docs, testes, formatação. Tempo caro em trabalho barato.",
      kind: "cards",
      items: [
        { n: "6h/semana", title: "Gastas em review", body: "Tempo que poderia estar em produto, arquitetura, ou pesquisa." },
        { n: "70%", title: "Dos PRs são triviais", body: "Bumps de dependência, docs, testes que só adicionam cobertura." },
        { n: "30min", title: "Tempo médio até 1º review", body: "Bloqueia o autor, atrasa o merge, atrasa o deploy." },
      ],
    },
    {
      title: "Como funciona",
      lead: "Do PR aberto à decisão em menos de 10 segundos.",
      kind: "steps",
      items: [
        { n: "1", title: "Lê o PR", body: "Webhook do GitHub. Sem clonar o repositório. Só os arquivos e patches." },
        { n: "2", title: "Classifica com LLM", body: "Trivial, sensível, ou incerto — com motivos concretos e confiança." },
        { n: "3", title: "Revisor adversarial", body: "Um segundo modelo, diferente, tenta refutar. Se discordar, escala." },
        { n: "4", title: "Aplica regras duras", body: "Path em auth/, security/, billing/ vai para humano. Sem exceção." },
        { n: "5", title: "Decide e registra", body: "Aprova, escala, ou comenta. Cada decisão fica no audit log." },
      ],
    },
    {
      title: "Veja o raciocínio ao vivo",
      lead: "Teste qualquer PR público sem instalar nada.",
      kind: "demo",
      demo: `<span class="mut"># cole a URL de um PR do GitHub</span>
$ weft review vercel/next.js#71000

<span class="ok">🟢 Weft aprovaria automaticamente</span>
<span class="mut">Classificação: trivial (confiança 94%)</span>
<span class="mut">Revisor adversarial: concordou</span>
<span class="mut">Motivos:</span>
<span class="mut">- Apenas arquivos .md</span>
<span class="mut">- Bump de patch em dependência</span>

<span class="warn">🟡 Weft escalaria para humano</span>
<span class="mut">Classificação: sensitive (confiança 89%)</span>
<span class="mut">Decisão: path sensível (auth/session.ts) — sempre humano</span>`,
    },
    {
      title: "Feito para quem não pode errar",
      kind: "cards",
      items: [
        { title: "Regra dura por path", body: "auth/, security/, billing/, migrations/ vão para humano independente do que o modelo diz." },
        { title: "Revisor adversarial", body: "Dois modelos independentes. Se discordam, o mais conservador vence." },
        { title: "Audit log completo", body: "Cada decisão tem autor, motivo, modelo, timestamp. Exportável em CSV." },
        { title: "Modo observação", body: "7 dias aprendendo sem agir. Você vê o que ele teria feito antes de deixá-lo decidir." },
        { title: "Self-hosted", body: "Docker + Helm. Seu código não sai da sua VPC. Licença MIT, sem pegadinha." },
        { title: "Regras verticais", body: "Templates prontos para SOC2, HIPAA, PCI-DSS. Ligar em 1 comando." },
      ],
    },
    {
      title: "Perguntas frequentes",
      kind: "faq",
      items: [
        { title: "Substitui o GitHub?", body: "Não. O Weft senta em cima do GitHub via App. Você continua usando o mesmo fluxo, o mesmo CI, o mesmo Git." },
        { title: "O que acontece se o modelo errar?", body: "Regra dura protege auth/security/billing. Para o resto, o pior caso é escalar para humano — falso positivo barato." },
        { title: "Quanto custa?", body: "Grátis para repositórios públicos. $20/dev/mês para privados no time. Business $50/dev/mês. Enterprise sob consulta." },
        { title: "Onde meus dados ficam?", body: "No modo cloud, em servidores nos EUA com criptografia em repouso. No modo self-hosted, onde você quiser." },
        { title: "Funciona com GitLab?", body: "Hoje é GitHub. GitLab está no roadmap para Q2. Interessado? Abra uma issue." },
      ],
    },
    {
      title: "Pronto para recuperar 6 horas por semana?",
      kind: "cta",
      cta: { title: "", label: "Instalar no GitHub", href: "https://github.com/apps/weft" },
    },
  ],
};

export function pageOSS(): LandingContent {
  return {
    meta: {
      title: "Weft para Open Source — filtro de ruído para maintainers",
      description: "Maintainers de projetos grandes recebem centenas de PRs de bots e IA por dia. O Weft filtra o trivial automaticamente, e escala só o que importa. Grátis para repos públicos.",
      path: "/para/oss",
      keywords: ["open source maintainer", "PR triage", "dependabot alternative", "bot PR filter"],
    },
    h1: "Você volta a se divertir mantendo open source.",
    lead: "Filtramos dependabot, docs, formatação e IA ruidosa. Escalamos só o que importa. Grátis para repos públicos, para sempre.",
    primaryCta: { label: "Instalar grátis", href: "https://github.com/apps/weft" },
    secondaryCta: { label: "Ver demo", href: "/demo" },
    sections: [
      { title: "Feito para maintainers exaustos", kind: "cards", items: [
        { title: "Zero config", body: "Instala, e em 30s os PRs de dependabot começam a ser aprovados sozinhos." },
        { title: "Regras que entendem OSS", body: "Novo autor? Primeiro PR? Só toca em testes? Sabe diferenciar." },
        { title: "Grátis para sempre", body: "Repositórios públicos não pagam. Nunca. Este é o compromisso." },
      ]},
      { title: "Sua marca no PR", kind: "demo", demo: `<span class="mut">// cada comentário do Weft é discreto e bem localizado</span>

<span class="ok">🟢 Weft aprovou este PR automaticamente.</span>
<span class="mut">Classificação: trivial · confiança 96%</span>
<span class="mut">Motivos:</span>
<span class="mut">- Apenas README.md alterado</span>
<span class="mut">- Bump de patch em dependência</span>

<span class="mut">&lt;sub&gt;Weft · MIT · &lt;a href="..."&gt;docs&lt;/a&gt;&lt;/sub&gt;</span>` },
    ],
  };
}

export function pageFintech(): LandingContent {
  return {
    meta: {
      title: "Weft para Fintech — review auditável para código regulado",
      description: "SOC2, PCI-DSS, BACEN. Cada mudança em código de pagamento precisa de trilha de auditoria. O Weft gera automaticamente, escala só o que exige humano, e exporta em formato aceito por auditor.",
      path: "/para/fintech",
      keywords: ["SOC2 code review", "PCI-DSS compliance", "auditoria de código fintech", "compliance engineering"],
    },
    h1: "Review auditável, para código que não pode errar.",
    lead: "SOC2, PCI-DSS e compliance bancário. Cada decisão registrada, cada regra explícita, cada auditoria exportável em segundos.",
    primaryCta: { label: "Agendar demo", href: "mailto:comercial@weft.dev" },
    secondaryCta: { label: "Ver regras", href: "/docs/verticais" },
    sections: [
      { title: "O que o auditor vai ver", kind: "cards", items: [
        { title: "Trilha completa", body: "Quem decidiu, quando, com qual evidência. Cada PR, cada linha." },
        { title: "Regras explícitas", body: "auth/ e payments/ exigem 2 aprovadores. Não é opinião do modelo — é política." },
        { title: "Export para auditor", body: "CSV/JSON com todos os eventos do período. Pronto para SOX, PCI, SOC2." },
      ]},
      { title: "Regra dura, sempre", kind: "demo", demo: `<span class="bad">🔴 Escalado para humano.</span>
<span class="mut">Path: payments/stripe-webhook.ts</span>
<span class="mut">Decisão: regra PCI-DSS-3.2.1</span>
<span class="mut">Revisores exigidos: 2 com role "approver"</span>
<span class="mut">Evidência registrada: audit_log#a1b2c3d4</span>
<span class="ok">✓ Exportável em CSV para auditoria</span>` },
    ],
  };
}

export function pageMonorepo(): LandingContent {
  return {
    meta: {
      title: "Weft para Monorepos — review em escala",
      description: "Monorepos com 100+ devs geram milhares de PRs por dia. O Weft processa em paralelo, aplica regras por diretório, e reduz a fila humana em 80% sem perder controle.",
      path: "/para/monorepo",
      keywords: ["monorepo code review", "trunk based development", "review escalável", "devops monorepo"],
    },
    h1: "Milhares de PRs por dia. Zero perda de controle.",
    lead: "Processa em paralelo, aplica regras por diretório, e mantém a fila humana no tamanho que faz sentido.",
    primaryCta: { label: "Falar com engenharia", href: "mailto:comercial@weft.dev" },
    sections: [
      { title: "Feito para o caos", kind: "cards", items: [
        { title: "Regras por diretório", body: "/platform/auth/ tem política diferente de /product/ui/. Você decide." },
        { title: "Processamento paralelo", body: "Webhook enfileira, processa em workers independentes." },
        { title: "Regras verticais por time", body: "Time de segurança, time de billing, time de UI. Cada um com sua política." },
      ]},
    ],
  };
}

export function pageCompliance(): LandingContent {
  return {
    meta: {
      title: "Weft Compliance — evidência para auditores",
      description: "Cada mudança em código sensível tem decisão documentada, motivo explícito e trilha rastreável. Aceito por auditores SOC2, HIPAA e PCI.",
      path: "/para/compliance",
      keywords: ["code compliance", "SOC2 automation", "HIPAA code review", "audit trail code"],
    },
    h1: "O control que seu auditor quer ver.",
    lead: "Não é \"IA que ajuda\". É evidência auditável. Cada decisão tem autor, timestamp, motivo e política aplicada.",
    primaryCta: { label: "Agendar com compliance", href: "mailto:comercial@weft.dev" },
    sections: [
      { title: "Por que compliance compra", kind: "cards", items: [
        { title: "Substitui planilha", body: "Hoje é planilha + humano. Vira sistema de registro." },
        { title: "Retenção configurável", body: "7 anos para SOX, 6 para HIPAA. Configurável por repositório." },
        { title: "Integra com Vanta/Drata", body: "O Weft entra como control nessas plataformas. Um clique." },
      ]},
    ],
  };
}
