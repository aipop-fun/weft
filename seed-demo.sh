#!/usr/bin/env bash
# seed-demo.sh — popula o banco local com 3 PRs de exemplo
# Uso: apenas em desenvolvimento. Nunca rodar em produção.
set -euo pipefail
cd "$(dirname "$0")"

# trava 1: recusa em produção
if [ "${WEFT_ENV:-dev}" = "production" ]; then
  echo "! seed-demo recusou rodar em produção (WEFT_ENV=production)"
  exit 1
fi

# trava 2: confirma se o banco já tem dados
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

DB="${WEFT_DB:-./data/weft.db}"
if [ -f "$DB" ]; then
  COUNT=$(bun -e '
    import { openDB } from "@weft/db";
    try {
      const { db } = openDB();
      const r = db.query("SELECT COUNT(*) AS n FROM repos").get();
      console.log(r.n);
    } catch { console.log("0"); }
  ' 2>/dev/null || echo "0")
  if [ "$COUNT" -gt 0 ]; then
    echo "! o banco já tem $COUNT repo(s)."
    printf "continuar mesmo assim? (y/N) "
    read -r ans
    [ "$ans" = "y" ] || { echo "cancelado."; exit 1; }
  fi
fi

# ---------- 3. insere os dados de exemplo ----------
bun -e '
import { openDB, upsertInstall, upsertRepo, upsertPR, saveClassification, audit } from "@weft/db";
const { db } = openDB();

const inst = upsertInstall(db, {
  github_installation_id: 99999,
  account_login: "demo",
  account_type: "Organization",
  access_token: null,
  token_expires_at: null,
});
const repo = upsertRepo(db, {
  install_id: inst.id,
  github_repo_id: 999991,
  owner: "demo",
  name: "monorepo",
  full_name: "demo/monorepo",
});

const cases = [
  { n: 1, title: "docs: corrige typo no README", author: "dependabot[bot]", intent: "trivial", decision: "approve", decided_by: "weft:auto" },
  { n: 2, title: "feat: adiciona endpoint /session", author: "alice", intent: "sensitive", decision: "request_human", decided_by: "weft:human-required" },
  { n: 3, title: "chore: bump eslint", author: "dependabot[bot]", intent: "trivial", decision: "observed", decided_by: "weft:observe" },
];

for (const c of cases) {
  const pr = upsertPR(db, {
    repo_id: repo.id, number: c.n,
    head_sha: "abc" + c.n, base_sha: "def" + c.n,
    title: c.title, author: c.author,
    additions: 10, deletions: 2, files_changed: 1, state: "open",
  });
  saveClassification(db, {
    pr_id: pr.id, intent: c.intent, reasons: ["seed"],
    model: "seed", tokens_in: 100, tokens_out: 50, latency_ms: 800,
    decision: c.decision, decided_by: c.decided_by,
  });
  audit(db, { repo_id: repo.id, pr_number: c.n, actor: "seed", action: c.decision });
}

console.log("✓ 3 PRs de exemplo inseridos");
'
