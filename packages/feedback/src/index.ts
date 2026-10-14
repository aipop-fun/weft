import type { Database } from "bun:sqlite";

// Cada PR vira um par (input, decisão, feedback). Isso constrói a moat de dados.

export function migrateFeedback(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      correct_kind TEXT,
      comment TEXT,
      reporter TEXT,
      org_id INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(pr_id, reporter, kind)
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_pr ON feedback(pr_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_kind ON feedback(kind);

    -- dataset de treino: pares (features, label) prontos para fine-tune
    CREATE TABLE IF NOT EXISTS training_pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1.0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_training_source ON training_pairs(source);
  `);
}

export interface FeedbackEvent {
  pr_id: number;
  kind: "correct" | "wrong_kind" | "wrong_reasoning" | "wrong_adversarial";
  correct_kind?: "trivial" | "sensitive" | "unknown";
  comment?: string;
  reporter?: string;
  org_id?: number;
}

export function recordFeedback(db: Database, ev: FeedbackEvent): number {
  db.query(`
    INSERT INTO feedback (pr_id, kind, correct_kind, comment, reporter, org_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(pr_id, reporter, kind) DO UPDATE SET
      correct_kind = excluded.correct_kind,
      comment = excluded.comment
  `).run(
    ev.pr_id, ev.kind,
    ev.correct_kind ?? null,
    ev.comment ?? null,
    ev.reporter ?? "anonymous",
    ev.org_id ?? null,
  );

  // Materializa um par de treino se for uma correção com rótulo
  if (ev.kind === "wrong_kind" && ev.correct_kind) {
    const row = db.query(`
      SELECT c.reasons, c.intent, p.title, p.number, p.author,
             r.full_name, c.model
      FROM pull_requests p
      JOIN classifications c ON c.pr_id = p.id
      JOIN repos r ON r.id = p.repo_id
      WHERE p.id = ?
    `).get(ev.pr_id) as any;

    if (row) {
      const input = JSON.stringify({
        title: row.title,
        author: row.author,
        repo: row.full_name,
      });
      const output = JSON.stringify({
        kind: ev.correct_kind,
        reasons: [`corrigido por humano: ${ev.comment ?? "(sem motivo)"}`],
        confidence: 0.95,
      });
      db.query(`
        INSERT INTO training_pairs (source, input, output, weight)
        VALUES ('human_correction', ?, ?, 2.0)
      `).run(input, output);
    }
  }

  return db.query(`SELECT last_insert_rowid() AS id`).get() as number;
}

export interface FeedbackStats {
  total: number;
  correct: number;
  wrong_kind: number;
  wrong_reasoning: number;
  wrong_adversarial: number;
  accuracy: number;
  training_pairs: number;
}

export function stats(db: Database, orgId?: number): FeedbackStats {
  const where = orgId != null ? "WHERE org_id = ?" : "";
  const params = orgId != null ? [orgId] : [];

  const r = db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN kind = 'correct' THEN 1 ELSE 0 END) AS correct,
      SUM(CASE WHEN kind = 'wrong_kind' THEN 1 ELSE 0 END) AS wrong_kind,
      SUM(CASE WHEN kind = 'wrong_reasoning' THEN 1 ELSE 0 END) AS wrong_reasoning,
      SUM(CASE WHEN kind = 'wrong_adversarial' THEN 1 ELSE 0 END) AS wrong_adversarial
    FROM feedback ${where}
  `).get(...params) as any;

  const tp = db.query(`SELECT COUNT(*) AS n FROM training_pairs`).get() as { n: number };

  const total = Number(r.total) || 0;
  const correct = Number(r.correct) || 0;
  return {
    total,
    correct,
    wrong_kind: Number(r.wrong_kind) || 0,
    wrong_reasoning: Number(r.wrong_reasoning) || 0,
    wrong_adversarial: Number(r.wrong_adversarial) || 0,
    accuracy: total ? correct / total : 0,
    training_pairs: tp.n,
  };
}

// ---------- export do dataset ----------
export function exportTrainingPairs(db: Database, source?: string): Array<{
  input: string; output: string; weight: number;
}> {
  const where = source ? "WHERE source = ?" : "";
  const params = source ? [source] : [];
  return db.query(`
    SELECT input, output, weight FROM training_pairs ${where} ORDER BY id
  `).all(...params) as any;
}

// ---------- export em formato JSONL para fine-tune ----------
export function toJSONL(rows: ReturnType<typeof exportTrainingPairs>): string {
  return rows.map((r) => JSON.stringify({
    messages: [
      { role: "system", content: "Você classifica pull requests por risco." },
      { role: "user", content: r.input },
      { role: "assistant", content: r.output },
    ],
    weight: r.weight,
  })).join("\n");
}
