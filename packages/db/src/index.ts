import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDB(path = process.env.WEFT_DB ?? "./data/weft.db"): { db: Database } {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  ensureColumns(db);
  return { db };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS installs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_installation_id INTEGER UNIQUE NOT NULL,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  access_token TEXT,
  token_expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  install_id INTEGER NOT NULL REFERENCES installs(id),
  github_repo_id INTEGER UNIQUE NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  number INTEGER NOT NULL,
  head_sha TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  title TEXT,
  author TEXT,
  additions INTEGER,
  deletions INTEGER,
  files_changed INTEGER,
  state TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(repo_id, number)
);

CREATE TABLE IF NOT EXISTS classifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL REFERENCES pull_requests(id),
  intent TEXT NOT NULL,
  reasons TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  decision TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(pr_id)
);

CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  path_prefix TEXT NOT NULL,
  required_human INTEGER NOT NULL DEFAULT 1,
  block_auto INTEGER NOT NULL DEFAULT 1,
  auto_approve_trivial INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(repo_id, path_prefix)
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER,
  pr_number INTEGER,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS rate (
  k TEXT PRIMARY KEY,
  tokens REAL NOT NULL,
  last INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pr_repo ON pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_audit_repo ON audit(repo_id);
`;

function ensureColumns(db: Database) {
  const cols = db.query(`PRAGMA table_info(repos)`).all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("observe_until"))
    db.exec(`ALTER TABLE repos ADD COLUMN observe_until INTEGER NOT NULL DEFAULT 0`);
  if (!names.has("observe_forever"))
    db.exec(`ALTER TABLE repos ADD COLUMN observe_forever INTEGER NOT NULL DEFAULT 0`);
}

export interface Install {
  id: number;
  github_installation_id: number;
  account_login: string;
  account_type: string;
  access_token: string | null;
  token_expires_at: number | null;
}

export interface RepoRow {
  id: number;
  install_id: number;
  github_repo_id: number;
  owner: string;
  name: string;
  full_name: string;
  enabled: number;
  observe_until: number;
  observe_forever: number;
}

export function upsertInstall(db: Database, i: Omit<Install, "id">): Install {
  db.query(`
    INSERT INTO installs (github_installation_id, account_login, account_type)
    VALUES (?, ?, ?)
    ON CONFLICT(github_installation_id) DO UPDATE SET
      account_login = excluded.account_login,
      account_type  = excluded.account_type
  `).run(i.github_installation_id, i.account_login, i.account_type);
  return db.query(`SELECT * FROM installs WHERE github_installation_id = ?`)
    .get(i.github_installation_id) as Install;
}

export function getInstall(db: Database, githubInstallationId: number): Install | null {
  return (db.query(`SELECT * FROM installs WHERE github_installation_id = ?`)
    .get(githubInstallationId) as Install) ?? null;
}

export function setInstallToken(db: Database, id: number, token: string, expiresAt: number): void {
  db.query(`UPDATE installs SET access_token = ?, token_expires_at = ? WHERE id = ?`)
    .run(token, expiresAt, id);
}

export function upsertRepo(db: Database, r: {
  install_id: number; github_repo_id: number; owner: string; name: string; full_name: string;
}): RepoRow {
  db.query(`
    INSERT INTO repos (install_id, github_repo_id, owner, name, full_name, observe_until)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(github_repo_id) DO UPDATE SET
      owner = excluded.owner, name = excluded.name, full_name = excluded.full_name
  `).run(r.install_id, r.github_repo_id, r.owner, r.name, r.full_name, Date.now() + 7 * 86400_000);
  return db.query(`SELECT * FROM repos WHERE github_repo_id = ?`)
    .get(r.github_repo_id) as RepoRow;
}

export function getRepoByFullName(db: Database, fullName: string): RepoRow | null {
  return (db.query(`SELECT * FROM repos WHERE full_name = ?`).get(fullName) as RepoRow) ?? null;
}

export function isObserving(repo: RepoRow): boolean {
  if (repo.observe_forever) return true;
  return Date.now() < repo.observe_until;
}

export function upsertPR(db: Database, p: {
  repo_id: number; number: number; head_sha: string; base_sha: string;
  title: string; author: string; additions: number; deletions: number;
  files_changed: number; state: string;
}) {
  db.query(`
    INSERT INTO pull_requests (repo_id, number, head_sha, base_sha, title, author, additions, deletions, files_changed, state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(repo_id, number) DO UPDATE SET
      head_sha = excluded.head_sha, base_sha = excluded.base_sha,
      title = excluded.title, author = excluded.author,
      additions = excluded.additions, deletions = excluded.deletions,
      files_changed = excluded.files_changed, state = excluded.state
  `).run(p.repo_id, p.number, p.head_sha, p.base_sha, p.title, p.author, p.additions, p.deletions, p.files_changed, p.state);
  return db.query(`SELECT * FROM pull_requests WHERE repo_id = ? AND number = ?`)
    .get(p.repo_id, p.number) as { id: number };
}

export function saveClassification(db: Database, c: {
  pr_id: number; intent: string; reasons: string[]; model: string;
  tokens_in?: number; tokens_out?: number; latency_ms?: number;
  decision: string; decided_by: string;
}) {
  db.query(`
    INSERT INTO classifications (pr_id, intent, reasons, model, tokens_in, tokens_out, latency_ms, decision, decided_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pr_id) DO UPDATE SET
      intent = excluded.intent, reasons = excluded.reasons, model = excluded.model,
      tokens_in = excluded.tokens_in, tokens_out = excluded.tokens_out,
      latency_ms = excluded.latency_ms, decision = excluded.decision,
      decided_by = excluded.decided_by
  `).run(c.pr_id, c.intent, JSON.stringify(c.reasons), c.model,
    c.tokens_in ?? null, c.tokens_out ?? null, c.latency_ms ?? null,
    c.decision, c.decided_by);
}

export function getRules(db: Database, repoId: number) {
  return db.query(`SELECT * FROM rules WHERE repo_id = ? ORDER BY length(path_prefix) DESC`)
    .all(repoId) as Array<{
      id: number; repo_id: number; path_prefix: string;
      required_human: number; block_auto: number; auto_approve_trivial: number;
    }>;
}

export function upsertRule(db: Database, r: {
  repo_id: number; path_prefix: string; required_human: number;
  block_auto: number; auto_approve_trivial: number;
}) {
  db.query(`
    INSERT INTO rules (repo_id, path_prefix, required_human, block_auto, auto_approve_trivial)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(repo_id, path_prefix) DO UPDATE SET
      required_human = excluded.required_human,
      block_auto = excluded.block_auto,
      auto_approve_trivial = excluded.auto_approve_trivial
  `).run(r.repo_id, r.path_prefix, r.required_human, r.block_auto, r.auto_approve_trivial);
}

export function audit(db: Database, a: {
  repo_id?: number; pr_number?: number; actor: string; action: string; details?: string;
}) {
  db.query(`INSERT INTO audit (repo_id, pr_number, actor, action, details) VALUES (?, ?, ?, ?, ?)`)
    .run(a.repo_id ?? null, a.pr_number ?? null, a.actor, a.action, a.details ?? null);
}

export function rateAllow(db: Database, key: string, capacity: number, perSecond: number): boolean {
  const now = Date.now();
  const row = db.query(`SELECT tokens, last FROM rate WHERE k = ?`)
    .get(key) as { tokens: number; last: number } | null;
  let tokens = capacity;
  if (row) {
    const elapsed = (now - row.last) / 1000;
    tokens = Math.min(capacity, row.tokens + elapsed * perSecond);
  }
  if (tokens < 1) {
    db.query(`
      INSERT INTO rate (k, tokens, last) VALUES (?, ?, ?)
      ON CONFLICT(k) DO UPDATE SET tokens = excluded.tokens, last = excluded.last
    `).run(key, tokens, now);
    return false;
  }
  tokens -= 1;
  db.query(`
    INSERT INTO rate (k, tokens, last) VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET tokens = excluded.tokens, last = excluded.last
  `).run(key, tokens, now);
  return true;
}
