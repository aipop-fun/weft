import type { Database } from "bun:sqlite";

export interface Org {
  id: number;
  slug: string;
  name: string;
  plan: "free" | "team" | "business" | "enterprise";
  created_at: number;
}

export interface User {
  id: number;
  email: string;
  name: string | null;
  provider: "google" | "github" | "email";
  provider_id: string;
  created_at: number;
}

export interface Membership {
  id: number;
  org_id: number;
  user_id: number;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: number;
}

export function migrateOrgs(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orgs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
    CREATE TABLE IF NOT EXISTS memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id INTEGER NOT NULL REFERENCES orgs(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(org_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // adicionar org_id nas tabelas existentes (idempotente)
  const tables = ["repos", "rules", "audit", "classifications"];
  for (const t of tables) {
    try {
      const cols = db.query(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>;
      const names = new Set(cols.map((c) => c.name));
      if (!names.has("org_id")) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN org_id INTEGER`);
      }
    } catch {}
  }
}

export function upsertUser(db: Database, u: {
  email: string; name: string | null; provider: "google" | "github" | "email"; provider_id: string;
}): User {
  db.query(`
    INSERT INTO users (email, name, provider, provider_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      provider = excluded.provider,
      provider_id = excluded.provider_id
  `).run(u.email, u.name ?? null, u.provider, u.provider_id);
  return db.query(`SELECT * FROM users WHERE email = ?`).get(u.email) as User;
}

export function createOrg(db: Database, slug: string, name: string, ownerUserId: number): Org {
  db.query(`INSERT INTO orgs (slug, name) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING`).run(slug, name);
  const org = db.query(`SELECT * FROM orgs WHERE slug = ?`).get(slug) as Org;
  db.query(`
    INSERT INTO memberships (org_id, user_id, role)
    VALUES (?, ?, 'owner')
    ON CONFLICT(org_id, user_id) DO UPDATE SET role = 'owner'
  `).run(org.id, ownerUserId);
  return org;
}

export function getUserOrgs(db: Database, userId: number): Array<Org & { role: string }> {
  return db.query(`
    SELECT o.*, m.role
    FROM orgs o
    JOIN memberships m ON m.org_id = o.id
    WHERE m.user_id = ?
    ORDER BY o.created_at
  `).all(userId) as Array<Org & { role: string }>;
}

export function createSession(db: Database, userId: number, ttlMs = 30 * 86400_000): string {
  const token = crypto.randomUUID();
  db.query(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .run(token, userId, Date.now() + ttlMs);
  return token;
}

export function getSession(db: Database, token: string): User | null {
  const s = db.query(`SELECT * FROM sessions WHERE token = ?`).get(token) as
    | { user_id: number; expires_at: number } | null;
  if (!s || s.expires_at < Date.now()) return null;
  return db.query(`SELECT * FROM users WHERE id = ?`).get(s.user_id) as User;
}

export function destroySession(db: Database, token: string): void {
  db.query(`DELETE FROM sessions WHERE token = ?`).run(token);
}
