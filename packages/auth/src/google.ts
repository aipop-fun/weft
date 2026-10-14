// OAuth 2.0 do Google, sem dependências externas.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function loadGoogleFromEnv(): GoogleConfig {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/auth/google/callback",
  };
}

export function isGoogleReady(cfg: GoogleConfig): boolean {
  return !!cfg.clientId && !!cfg.clientSecret;
}

export function authURL(cfg: GoogleConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    state,
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

export interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export async function exchangeCode(cfg: GoogleConfig, code: string): Promise<GoogleUser> {
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  });
  const tr = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tr.ok) throw new Error(`google token: ${tr.status} ${await tr.text()}`);
  const tok = (await tr.json()) as { access_token: string };

  const ur = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${tok.access_token}` },
  });
  if (!ur.ok) throw new Error(`google userinfo: ${ur.status}`);
  const u = (await ur.json()) as GoogleUser;
  return u;
}
