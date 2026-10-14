import { sign } from "node:crypto";
import { readFileSync } from "node:fs";

export interface AppConfig {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  apiBase: string;
}

// Carrega config de forma TOLERANTE — não falha se variáveis ausentes.
// Só falha quando você realmente precisa de um token (installationToken).
export function loadConfigFromEnv(): AppConfig {
  const keyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
  let privateKey = "";
  if (keyPath && keyPath.trim() !== "" && keyPath !== "./private-key.pem") {
    try {
      privateKey = readFileSync(keyPath, "utf8");
    } catch {
      privateKey = "";
    }
  } else if (keyPath === "./private-key.pem") {
    // caminho default — tenta ler, ignora se não existir
    try {
      privateKey = readFileSync(keyPath, "utf8");
    } catch {
      privateKey = "";
    }
  } else if (process.env.GITHUB_PRIVATE_KEY) {
    privateKey = process.env.GITHUB_PRIVATE_KEY;
  }

  return {
    appId: process.env.GITHUB_APP_ID ?? "",
    privateKey,
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
    apiBase: process.env.GITHUB_API_BASE ?? "https://api.github.com",
  };
}

export function isGitHubConfigured(cfg: AppConfig): boolean {
  return (
    cfg.appId !== "" &&
    cfg.privateKey !== "" &&
    cfg.webhookSecret !== ""
  );
}

function requireConfig(cfg: AppConfig): void {
  if (!cfg.appId) throw new Error("GITHUB_APP_ID ausente");
  if (!cfg.privateKey) throw new Error("GITHUB_PRIVATE_KEY ausente (defina GITHUB_PRIVATE_KEY_PATH ou GITHUB_PRIVATE_KEY)");
  if (!cfg.webhookSecret) throw new Error("GITHUB_WEBHOOK_SECRET ausente");
}

export function appJWT(cfg: AppConfig): string {
  requireConfig(cfg);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 9 * 60, iss: cfg.appId };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = sign("RSA-SHA256", Buffer.from(data), cfg.privateKey).toString("base64url");
  return `${data}.${sig}`;
}

export async function installationToken(
  cfg: AppConfig,
  installationId: number,
): Promise<{ token: string; expiresAt: number }> {
  requireConfig(cfg);
  const jwt = appJWT(cfg);
  const r = await fetch(`${cfg.apiBase}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${jwt}`,
      accept: "application/vnd.github+json",
      "user-agent": "weft",
    },
  });
  if (!r.ok) throw new Error(`installation token: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { token: string; expires_at: string };
  return { token: j.token, expiresAt: new Date(j.expires_at).getTime() };
}
