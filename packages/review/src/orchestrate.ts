import type { Database } from "bun:sqlite";
import { GitHub, type PullFile } from "@weft/github";
import { classify, type Intent } from "@weft/intent";
import { challenge, reconcile, type Challenge } from "@weft/intent/adversarial";
import { decide } from "@weft/rules";
import type { LLMConfig } from "@weft/llm";
import {
  getRules, getRepoByFullName, saveClassification, upsertPR, audit, isObserving,
} from "@weft/db";

export interface ReviewContext {
  db: Database;
  github: GitHub;
  llm: LLMConfig;
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prBody: string;
  prAuthor: string;
  headSha: string;
  baseSha: string;
}

export interface ReviewResult {
  intent: Intent;
  challenge: Challenge;
  decision: ReturnType<typeof decide>;
  observing: boolean;
  commentUrl?: string;
}

export async function reviewPullRequest(ctx: ReviewContext): Promise<ReviewResult> {
  const { db, github, llm, owner, repo, prNumber } = ctx;

  const repoRow = getRepoByFullName(db, `${owner}/${repo}`);
  if (!repoRow) throw new Error(`repo não registrado: ${owner}/${repo}`);
  const repoId = repoRow.id;
  const observing = isObserving(repoRow);

  const files: PullFile[] = await github.prFiles(owner, repo, prNumber);
  const additions = files.reduce((a, f) => a + f.additions, 0);
  const deletions = files.reduce((a, f) => a + f.deletions, 0);

  const prRow = upsertPR(db, {
    repo_id: repoId, number: prNumber,
    head_sha: ctx.headSha, base_sha: ctx.baseSha,
    title: ctx.prTitle, author: ctx.prAuthor,
    additions, deletions, files_changed: files.length, state: "open",
  });

  const proposed = await classify(llm, {
    title: ctx.prTitle, body: ctx.prBody, author: ctx.prAuthor, files,
  });

  const chal = await challenge(llm, {
    title: ctx.prTitle, body: ctx.prBody, files,
  }, proposed);

  const final = reconcile(proposed, chal);

  const rules = getRules(db, repoId);
  const decision = decide(final, files, rules);

  const commentBody = formatComment(final, chal, decision, observing, files);

  let commentUrl: string | undefined;
  try {
    if (observing) {
      const r = await github.comment(owner, repo, prNumber, commentBody);
      commentUrl = r.html_url;
    } else if (decision.action === "approve") {
      const r = await github.submitReview(owner, repo, prNumber, {
        event: "APPROVE",
        body: commentBody,
      });
      commentUrl = r.html_url;
    } else {
      const r = await github.comment(owner, repo, prNumber, commentBody);
      commentUrl = r.html_url;
    }
  } catch (e) {
    audit(db, {
      repo_id: repoId, pr_number: prNumber,
      actor: "weft", action: "review_failed",
      details: (e as Error).message,
    });
    throw e;
  }

  saveClassification(db, {
    pr_id: prRow.id,
    intent: final.kind,
    reasons: final.reasons,
    model: final.model,
    tokens_in: final.tokensIn,
    tokens_out: final.tokensOut,
    latency_ms: final.latencyMs,
    decision: observing ? "observed" : decision.action,
    decided_by: observing
      ? "weft:observe"
      : decision.action === "approve" ? "weft:auto" : "weft:human-required",
  });

  audit(db, {
    repo_id: repoId, pr_number: prNumber,
    actor: "weft",
    action: observing ? "observe" : `decision:${decision.action}`,
    details: `${final.kind} (${final.confidence.toFixed(2)})` +
      (chal.agrees ? " · revisor concordou" : ` · revisor discordou`),
  });

  return { intent: final, challenge: chal, decision, observing, commentUrl };
}

function formatComment(
  intent: Intent,
  chal: Challenge,
  decision: ReturnType<typeof decide>,
  observing: boolean,
  files: PullFile[],
): string {
  const emoji = intent.kind === "trivial" ? "🟢" : intent.kind === "sensitive" ? "🔴" : "🟡";
  let header: string;
  if (observing) {
    header = `🔍 **Weft está observando este PR** (modo aprendizado).\n\n_Ainda não aprova automaticamente. Configurado para começar a agir em breve._`;
  } else if (decision.action === "approve") {
    header = `${emoji} **Weft aprovou este PR automaticamente.**`;
  } else {
    header = `${emoji} **Weft escalou este PR para revisão humana.**`;
  }

  const conf = (intent.confidence * 100).toFixed(0);
  const reasons = intent.reasons.map((r) => `- ${r}`).join("\n") || "- (sem detalhes)";
  const revisorBlock = chal.agrees
    ? `**Revisor adversarial:** concordou.`
    : `**Revisor adversarial:** ⚠️ discordou — _"${chal.challenge.slice(0, 300)}"_`;

  const breakdown = files.length <= 20
    ? files.map((f) => `\`${f.status}\` \`${f.filename}\` (+${f.additions}/-${f.deletions})`).join("\n")
    : `_${files.length} arquivos alterados_`;

  const ruleBlock = decision.matchedRules.length
    ? `**Regras aplicadas:** ${decision.matchedRules.map((r) => `\`${r}\``).join(", ")}\n`
    : "";

  return `${header}

**Classificação:** \`${intent.kind}\` (confiança ${conf}%)
**Decisão:** ${decision.reason}
${decision.requiredHuman ? `**Revisores humanos exigidos:** ${decision.requiredHuman}\n` : ""}${ruleBlock}
**Motivos:**
${reasons}

${revisorBlock}

<details>
<summary>Arquivos (${files.length})</summary>

${breakdown}

</details>

<sub>Weft · \`${intent.model}\`${observing ? " · modo observação" : ""}</sub>`;
}
