const STYLES = `body{margin:0;font:15px/1.7 system-ui,sans-serif;background:#0a0a0b;color:#e5e5e7}
.wrap{max-width:760px;margin:0 auto;padding:64px 24px}
h1{font-size:32px;margin-bottom:8px;letter-spacing:-.02em}
h2{font-size:20px;margin:40px 0 12px}
p,li{color:#d4d4d8}
a{color:#7dd3fc}
.mut{color:#a1a1aa;font-size:14px}
nav{padding:20px 32px;border-bottom:1px solid #1a1a1e}
nav a{color:#e5e5e7;text-decoration:none;font-weight:600;margin-right:24px}
nav a:last-child{color:#a1a1aa;font-weight:400}`;

function wrap(title: string, body: string): string {
  return `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Weft</title><style>${STYLES}</style></head><body>
<nav><a href="/">weft</a><a href="/privacidade">Privacidade</a><a href="/termos">Termos</a><a href="/seguranca">Segurança</a></nav>
<div class="wrap">${body}</div></body></html>`;
}

const UPDATED = "Última atualização: 14 de outubro de 2026";

export const PRIVACY = wrap("Política de Privacidade", `
<h1>Política de Privacidade</h1>
<p class="mut">${UPDATED}</p>
<h2>1. Quem somos</h2>
<p>Weft é uma ferramenta de automação de review de código open source (MIT).</p>
<h2>2. Dados que coletamos</h2>
<ul>
<li><strong>Conta:</strong> email, nome e foto via Google OAuth.</li>
<li><strong>Código:</strong> metadados de PRs. Não armazenamos seu repositório.</li>
<li><strong>Logs:</strong> IP, user-agent, timestamp, decisões.</li>
<li><strong>Pagamento:</strong> processado pelo Stripe. Não armazenamos cartão.</li>
</ul>
<h2>3. Como usamos</h2>
<ul>
<li>Classificar PRs, aplicar regras, gerar auditoria.</li>
<li>Melhorar o produto com feedback agregado.</li>
<li>Emails transacionais.</li>
</ul>
<h2>4. Compartilhamento</h2>
<p>Não vendemos dados. Compartilhamos com OpenRouter, Anthropic, Stripe, Fly.io.</p>
<h2>5. Retenção</h2>
<p>Conta: enquanto existir + 30 dias. Auditoria: 24 meses. Backups: 7 dias.</p>
<h2>6. Seus direitos (LGPD/GDPR)</h2>
<p>Acesso, correção, exclusão e portabilidade via <a href="mailto:privacidade@weft.dev">privacidade@weft.dev</a>.</p>
<h2>7. Cookies</h2>
<p>Usamos um cookie essencial: <code>weft_session</code>. Sem rastreamento.</p>
<h2>8. Contato</h2>
<p>DPO: <a href="mailto:dpo@weft.dev">dpo@weft.dev</a></p>
`);

export const TERMS = wrap("Termos de Uso", `
<h1>Termos de Uso</h1>
<p class="mut">${UPDATED}</p>
<h2>1. Aceitação</h2>
<p>Ao instalar o Weft, você concorda com estes termos.</p>
<h2>2. Uso permitido</h2>
<p>Automatizar decisões de review em repositórios que você controla. Proibido usar sem autorização ou burlar regra dura de paths sensíveis.</p>
<h2>3. Isenção de garantia</h2>
<p>Fornecido "como está". A regra dura por path é proteção adicional, não substitui revisão humana em código crítico.</p>
<h2>4. Limitação</h2>
<p>Responsabilidade total limitada ao valor pago nos últimos 12 meses.</p>
<h2>5. Cancelamento</h2>
<p>Sem multa. Reembolso proporcional em caso de falha material.</p>
<h2>6. Foro</h2>
<p>Leis do Brasil.</p>
`);

export const SECURITY = wrap("Segurança", `
<h1>Segurança</h1>
<p class="mut">${UPDATED}</p>
<h2>Divulgação responsável</h2>
<p>Envie vulnerabilidades para <a href="mailto:security@weft.dev">security@weft.dev</a>. Respondemos em até 48h.</p>
<h2>Não faça</h2>
<ul>
<li>Testar em contas de terceiros.</li>
<li>Exfiltrar dados.</li>
<li>Atacar produção.</li>
</ul>
<h2>Boas práticas</h2>
<ul>
<li>Content-addressed storage — auditável.</li>
<li>Sessões rotacionadas a cada 24h.</li>
<li>CSRF em todas as mutações.</li>
<li>Regra dura por path.</li>
<li>Self-hosting disponível.</li>
</ul>
<h2>Hospedagem</h2>
<p>Fly.io (gru — São Paulo). Criptografia em repouso e em trânsito.</p>
`);
