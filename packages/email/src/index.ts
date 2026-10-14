// Envia email transacional via Resend (free tier: 3k/mês).
// Fallback: só loga se RESEND_API_KEY não estiver setada.

const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const FROM = process.env.EMAIL_FROM ?? "Weft <ola@weft.dev>";

export async function send(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_KEY) {
    console.log(`[email] skipped (no key): ${to} — ${subject}`);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!r.ok) console.error(`[email] ${r.status}: ${await r.text()}`);
}

export function welcomeEmail(name: string, orgSlug: string): string {
  return `
<div style="font:15px/1.6 system-ui,sans-serif;background:#0a0a0b;color:#e5e5e7;padding:32px;max-width:520px">
  <h1 style="font-size:24px;margin:0 0 16px">Bem-vindo ao Weft, ${name}.</h1>
  <p style="color:#a1a1aa">Sua organização <strong style="color:#e5e5e7">${orgSlug}</strong> está pronta.</p>
  <p style="color:#a1a1aa">O Weft analisa pull requests automaticamente, aprova o trivial e escala só o que precisa de humano.</p>
  <p style="margin:24px 0">
    <a href="https://weft.dev/comecando" style="display:inline-block;padding:12px 24px;background:#7dd3fc;color:#0a0a0b;text-decoration:none;border-radius:8px;font-weight:600">Começar</a>
  </p>
  <p style="color:#52525b;font-size:12px">Weft · open source · MIT</p>
</div>`;
}
