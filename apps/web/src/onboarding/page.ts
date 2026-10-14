export const COMECANDO = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Começando — Weft</title>
<style>
body{margin:0;font:15px/1.7 system-ui,sans-serif;background:#0a0a0b;color:#e5e5e7}
nav{padding:20px 32px;border-bottom:1px solid #1a1a1e}
nav a{color:#e5e5e7;text-decoration:none;font-weight:600}
.wrap{max-width:680px;margin:0 auto;padding:64px 24px}
h1{font-size:32px;margin-bottom:8px;letter-spacing:-.02em}
.sub{color:#a1a1aa;margin-bottom:48px}
.step{display:flex;gap:20px;padding:24px 0;border-bottom:1px solid #1a1a1e}
.step:last-child{border-bottom:none}
.n{flex-shrink:0;width:36px;height:36px;border:1px solid #26262a;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#7dd3fc;font-family:ui-monospace,monospace;font-size:14px}
.n.done{background:#052e16;color:#86efac;border-color:#14532d}
h3{margin:0 0 4px;font-size:16px}
p{margin:0;color:#a1a1aa;font-size:14px}
a.btn{display:inline-block;margin-top:12px;padding:8px 16px;background:#131316;border:1px solid #26262a;border-radius:6px;color:#e5e5e7;text-decoration:none;font-size:13px}
a.btn:hover{border-color:#7dd3fc}
</style>
</head>
<body>
<nav><a href="/">weft</a></nav>
<div class="wrap">
  <h1>Bem-vindo ao Weft</h1>
  <p class="sub">Cinco passos para o Weft começar a trabalhar para você.</p>

  <div class="step"><div class="n done">✓</div><div><h3>Conta criada</h3><p>Sua sessão está ativa.</p></div></div>

  <div class="step"><div class="n">2</div><div>
    <h3>Instale o GitHub App</h3>
    <p>Autorize o Weft nos repositórios que quiser analisar.</p>
    <a class="btn" href="https://github.com/apps/weft" target="_blank">Instalar no GitHub →</a>
  </div></div>

  <div class="step"><div class="n">3</div><div>
    <h3>Configure as regras</h3>
    <p>Escolha um template (SOC2, HIPAA, PCI) ou defina regras manuais.</p>
    <a class="btn" href="/dashboard">Ir para dashboard →</a>
  </div></div>

  <div class="step"><div class="n">4</div><div>
    <h3>Veja o primeiro PR sendo classificado</h3>
    <p>Abra um PR ou teste no demo público.</p>
    <a class="btn" href="/demo">Testar demo →</a>
  </div></div>

  <div class="step"><div class="n">5</div><div>
    <h3>Modo observação (recomendado)</h3>
    <p>Nos primeiros 7 dias, o Weft só comenta — não aprova nem escala.</p>
    <p style="margin-top:8px"><strong style="color:#fcd34d">Ativo por padrão.</strong></p>
  </div></div>
</div>
</body>
</html>`;
