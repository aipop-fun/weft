export const LANDING = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weft — Review de PR em piloto automático</title>
<meta name="description" content="Weft reduz review de PR em 80%. Aprova o trivial, escala o sensível.">
<style>
  :root{--bg:#0a0a0b;--fg:#e5e5e7;--mut:#a1a1aa;--acc:#7dd3fc;--ok:#86efac;--bad:#fca5a5}
  *{box-sizing:border-box}
  body{margin:0;font:16px/1.6 system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg)}
  header{padding:20px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1a1a1e}
  header a{color:var(--fg);text-decoration:none;font-weight:600}
  header nav a{margin-left:24px;color:var(--mut);font-weight:400}
  .hero{max-width:800px;margin:0 auto;padding:80px 24px;text-align:center}
  h1{font-size:48px;line-height:1.1;margin:0 0 16px;letter-spacing:-0.02em}
  h1 span{color:var(--acc)}
  .sub{font-size:20px;color:var(--mut);margin-bottom:40px}
  .cta{display:inline-block;padding:14px 28px;background:var(--acc);color:#0a0a0b;text-decoration:none;border-radius:8px;font-weight:600}
  .cta:hover{opacity:0.9}
  .cta2{display:inline-block;padding:14px 28px;background:#131316;color:var(--fg);text-decoration:none;border-radius:8px;font-weight:600;border:1px solid #26262a;margin-left:12px}
  section{max-width:1000px;margin:0 auto;padding:64px 24px}
  h2{font-size:28px;margin:0 0 24px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px}
  .card{background:#131316;border:1px solid #1a1a1e;border-radius:10px;padding:24px}
  .card h3{margin:0 0 8px;font-size:16px}
  .card p{margin:0;color:var(--mut);font-size:14px}
  .demo{background:#131316;border-radius:10px;padding:24px;margin-top:32px;font-family:ui-monospace,monospace;font-size:13px;line-height:1.7}
  .demo .t{color:var(--ok)}.demo .s{color:var(--bad)}.demo .m{color:var(--mut)}
  footer{text-align:center;padding:48px 24px;color:var(--mut);font-size:14px}
</style>
</head>
<body>
<header>
  <a href="/">weft</a>
  <nav>
    <a href="/demo">Demo</a>
    <a href="/dashboard">Dashboard</a>
    <a href="/docs">Docs</a>
  </nav>
</header>
<div class="hero">
  <h1>Seu time revisa <span>1 PR em cada 10</span>. O Weft cuida dos outros 9.</h1>
  <p class="sub">Cole a URL de qualquer PR público. Veja a classificação em 2 segundos. Sem instalar nada.</p>
  <a class="cta" href="/demo">Testar com um PR público</a>
  <a class="cta2" href="https://github.com/apps/weft">Instalar no GitHub</a>
</div>
<section>
  <h2>Como funciona</h2>
  <div class="grid">
    <div class="card"><h3>1. Lê o PR</h3><p>Cada PR aberto, atualizado ou reaberto dispara um webhook. O Weft baixa arquivos e patches.</p></div>
    <div class="card"><h3>2. Classifica</h3><p>Um LLM lê o diff e decide: <span style="color:var(--ok)">trivial</span>, <span style="color:var(--bad)">sensível</span>, ou incerto.</p></div>
    <div class="card"><h3>3. Revisor adversarial</h3><p>Um segundo LLM tenta refutar. Se discordar, escala para humano. Mais conservador vence.</p></div>
    <div class="card"><h3>4. Regra dura</h3><p>Paths em <code>auth/</code>, <code>security/</code>, <code>billing/</code> sempre humano. Sem exceção.</p></div>
  </div>
  <div class="demo">
    <div class="t">🟢 Weft aprovou este PR automaticamente.</div>
    <div class="m">Classificação: trivial (confiança 94%)</div>
    <div class="m">Revisor adversarial: concordou.</div>
    <br>
    <div class="s">🔴 Weft escalou este PR para revisão humana.</div>
    <div class="m">Classificação: sensitive (confiança 89%)</div>
    <div class="m">Decisão: path sensível (auth/session.go) — sempre revisão humana</div>
  </div>
</section>
<footer><p>Weft é open source (MIT). <a href="/docs" style="color:var(--mut)">Documentação</a> · <a href="/dashboard" style="color:var(--mut)">Dashboard</a></p></footer>
</body>
</html>`;

export const DASHBOARD = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Weft — Dashboard</title>
<style>
  body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#0a0a0b;color:#e5e5e7}
  header{padding:16px 24px;border-bottom:1px solid #1a1a1e;display:flex;gap:24px;align-items:baseline}
  header a{color:#e5e5e7;text-decoration:none;font-weight:600}
  header nav a{color:#a1a1aa;margin-left:16px;font-weight:400}
  main{max-width:1200px;margin:0 auto;padding:32px 24px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:32px}
  .kpi{background:#131316;border:1px solid #1a1a1e;border-radius:10px;padding:20px}
  .kpi .label{color:#a1a1aa;font-size:12px;text-transform:uppercase;letter-spacing:0.05em}
  .kpi .value{font-size:32px;font-weight:600;margin-top:4px}
  .kpi .value.ok{color:#86efac}.kpi .value.warn{color:#fcd34d}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #1a1a1e;font-size:13px}
  th{color:#a1a1aa;font-size:11px;text-transform:uppercase}
  .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px}
  .trivial{background:#052e16;color:#86efac}
  .sensitive{background:#450a0a;color:#fca5a5}
  .unknown{background:#422006;color:#fcd34d}
  .approve{background:#052e16;color:#86efac}
  .request_human{background:#422006;color:#fcd34d}
  .observed{background:#1e1b4b;color:#a5b4fc}
  .empty{color:#a1a1aa;padding:48px;text-align:center}
</style>
</head>
<body>
<header>
  <a href="/">weft</a>
  <nav><a href="/dashboard">Dashboard</a><a href="/demo">Demo</a><a href="/docs">Docs</a></nav>
</header>
<main>
  <h1 style="margin:0 0 24px;font-size:20px">Visão geral</h1>
  <div class="kpis" id="kpis"></div>
  <h2 style="font-size:16px;margin:32px 0 12px">Últimos PRs</h2>
  <table><thead><tr><th>Repo</th><th>PR</th><th>Título</th><th>Autor</th><th>Intent</th><th>Decisão</th></tr></thead><tbody id="rows"></tbody></table>
</main>
<script>
async function refresh() {
  try {
    const s = await (await fetch('/api/stats')).json();
    const total = Number(s.total) || 0;
    const approved = Number(s.approved) || 0;
    const rate = total ? Math.round((approved / total) * 100) : 0;
    document.getElementById('kpis').innerHTML = \`
      <div class="kpi"><div class="label">PRs analisados</div><div class="value">\${total}</div></div>
      <div class="kpi"><div class="label">Auto-aprovados</div><div class="value ok">\${approved}</div></div>
      <div class="kpi"><div class="label">Escalados</div><div class="value warn">\${s.escalated ?? 0}</div></div>
      <div class="kpi"><div class="label">Em observação</div><div class="value">\${s.observed ?? 0}</div></div>
      <div class="kpi"><div class="label">Latência média</div><div class="value">\${Math.round(s.avg_latency ?? 0)}ms</div></div>
    \`;
    const recent = await (await fetch('/api/recent')).json();
    const rows = document.getElementById('rows');
    if (!recent.length) {
      rows.innerHTML = '<tr><td colspan="6" class="empty">Sem PRs ainda. Instale o app e abra um PR, ou use <a href="/demo" style="color:#7dd3fc">/demo</a>.</td></tr>';
      return;
    }
    rows.innerHTML = '';
    for (const c of recent) {
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${esc(c.repo ?? '')}</td>
        <td>#\${c.number}</td>
        <td>\${esc(c.title ?? '')}</td>
        <td>\${esc(c.author ?? '')}</td>
        <td><span class="badge \${c.intent}">\${c.intent}</span></td>
        <td><span class="badge \${c.decision}">\${c.decision}</span></td>
      \`;
      rows.appendChild(tr);
    }
  } catch (e) {
    console.error(e);
  }
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;

export const DOCS = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Weft — Docs</title>
<style>
  body{margin:0;font:15px/1.7 system-ui,sans-serif;background:#0a0a0b;color:#e5e5e7}
  header{padding:16px 24px;border-bottom:1px solid #1a1a1e}
  header a{color:#e5e5e7;text-decoration:none;font-weight:600}
  main{max-width:720px;margin:0 auto;padding:48px 24px}
  h1{font-size:28px;margin:0 0 8px}
  h2{font-size:18px;margin:40px 0 12px}
  p,li{color:#d4d4d8}
  code{background:#131316;padding:2px 6px;border-radius:4px;font-size:13px}
  pre{background:#131316;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px}
  pre code{padding:0;background:none}
  a{color:#7dd3fc}
</style>
</head>
<body>
<header><a href="/">weft</a></header>
<main>
<h1>Como usar o Weft</h1>
<p>O Weft é um GitHub App. Instale em 30 segundos e ele começa a analisar PRs imediatamente.</p>
<h2>1. Testar sem instalar</h2>
<p>Abra <a href="/demo">/demo</a> e cole a URL de um PR público. Funciona com a <code>ANTHROPIC_API_KEY</code> configurada no servidor.</p>
<h2>2. Instalar no GitHub</h2>
<p>Crie um GitHub App, configure permissões (<code>Pull requests: Read &amp; write</code>, <code>Contents: Read</code>, <code>Metadata: Read</code>), e aponte o webhook para o servidor.</p>
<h2>3. Modo observação (padrão)</h2>
<p>Nos primeiros 7 dias, o Weft só comenta. Não aprova, não escala. Você vê o que ele <em>teria</em> feito. Depois, age.</p>
<h2>4. Regra dura</h2>
<p>Qualquer mudança em <code>auth/</code>, <code>security/</code>, <code>billing/</code>, <code>migrations/</code>, <code>.github/workflows/</code> vai para humano. Sem exceção.</p>
<h2>5. Revisor adversarial</h2>
<p>Um segundo LLM tenta refutar a classificação. Se discordar, a decisão vira <code>unknown</code> e escala para humano.</p>
<h2>6. Self-hosting</h2>
<pre><code>git clone https://github.com/SEU_USER/weft
cd weft
bun install
cp .env.example .env
./dev.sh</code></pre>
<h2>Licença</h2>
<p>MIT. Sem pegadinha.</p>
</main>
</body>
</html>`;
