import type { Intent } from "@weft/intent";
import { hitsHardPath } from "./hardpaths";

export interface RepoRule {
  path_prefix: string;
  required_human: number;
  block_auto: number;
  auto_approve_trivial: number;
}

export interface Decision {
  action: "approve" | "request_human" | "comment";
  reason: string;
  matchedRules: string[];
  requiredHuman: number;
}

export function decide(
  intent: Intent,
  files: Array<{ filename: string }>,
  rules: RepoRule[],
  opts: { alwaysAutoTrivial: boolean } = { alwaysAutoTrivial: false },
): Decision {
  const hard = hitsHardPath(files);
  if (hard) {
    return {
      action: "request_human",
      reason: `path sensível (${hard}) — sempre revisão humana`,
      matchedRules: ["hard-path"],
      requiredHuman: 1,
    };
  }

  const matched = rules.filter((r) =>
    files.some((f) => f.filename.startsWith(r.path_prefix)),
  );

  const blockers = matched.filter((r) => r.block_auto && r.required_human > 0);
  if (blockers.length) {
    const max = Math.max(...blockers.map((r) => r.required_human));
    return {
      action: "request_human",
      reason: `paths protegidos: ${blockers.map((r) => r.path_prefix).join(", ")}`,
      matchedRules: blockers.map((r) => r.path_prefix),
      requiredHuman: max,
    };
  }

  if (intent.kind === "trivial") {
    const explicit = matched.some((r) => r.auto_approve_trivial);
    if (explicit || opts.alwaysAutoTrivial || matched.length === 0) {
      return {
        action: "approve",
        reason: "PR trivial, sem regra bloqueante",
        matchedRules: matched.map((r) => r.path_prefix),
        requiredHuman: 0,
      };
    }
  }

  const required = matched.length ? Math.max(...matched.map((r) => r.required_human)) : 1;
  return {
    action: "request_human",
    reason: intent.kind === "sensitive" ? "PR sensível" : "classificação incerta",
    matchedRules: matched.map((r) => r.path_prefix),
    requiredHuman: required,
  };
}
