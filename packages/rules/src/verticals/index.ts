// Templates de regras por vertical. Cada um retorna uma lista de RepoRule
// que pode ser aplicada a um repositório via API.
import type { RepoRule } from "../decide";

export interface VerticalTemplate {
  id: string;
  name: string;
  description: string;
  rules: Omit<RepoRule, "id" | "repo_id">[];
}

export const SOC2: VerticalTemplate = {
  id: "soc2",
  name: "SOC2 (Trust Services Criteria)",
  description:
    "Requisitos do TSC para mudanças em código. Foco em CC6 (acesso), CC7 (operação), CC8 (mudança).",
  rules: [
    { path_prefix: "auth/",          required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "security/",      required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "crypto/",        required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "billing/",       required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "payments/",      required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "infra/",         required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "terraform/",     required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: ".github/workflows/", required_human: 1, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "migrations/",    required_human: 1, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "docs/",          required_human: 0, block_auto: 0, auto_approve_trivial: 1 },
  ],
};

export const HIPAA: VerticalTemplate = {
  id: "hipaa",
  name: "HIPAA (PHI)",
  description:
    "Regras para código que toca dados de saúde. Mínimo necessário, criptografia obrigatória, auditoria de acesso.",
  rules: [
    { path_prefix: "phi/",           required_human: 3, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "patients/",      required_human: 3, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "health/",        required_human: 3, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "auth/",          required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "crypto/",        required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "audit/",         required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "migrations/",    required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
  ],
};

export const PCI: VerticalTemplate = {
  id: "pci",
  name: "PCI-DSS 4.0",
  description:
    "Requisitos para código que processa cartão. Req 3 (dados), Req 6 (desenvolvimento seguro), Req 10 (log).",
  rules: [
    { path_prefix: "payments/",      required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "billing/",       required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "card/",          required_human: 3, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "pci/",           required_human: 3, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "crypto/",        required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: "auth/",          required_human: 2, block_auto: 1, auto_approve_trivial: 0 },
    { path_prefix: ".github/workflows/", required_human: 1, block_auto: 1, auto_approve_trivial: 0 },
  ],
};

export const OSS: VerticalTemplate = {
  id: "oss",
  name: "Open Source (permissivo)",
  description:
    "Foco em confiança: bloqueia bots desconhecidos, aprova triviais, escala código de novatos para revisão de maintainer.",
  rules: [
    { path_prefix: "src/",           required_human: 0, block_auto: 0, auto_approve_trivial: 1 },
    { path_prefix: "lib/",           required_human: 0, block_auto: 0, auto_approve_trivial: 1 },
    { path_prefix: "docs/",          required_human: 0, block_auto: 0, auto_approve_trivial: 1 },
    { path_prefix: "tests/",         required_human: 0, block_auto: 0, auto_approve_trivial: 1 },
    { path_prefix: "packages/",      required_human: 0, block_auto: 0, auto_approve_trivial: 1 },
  ],
};

export const ALL: VerticalTemplate[] = [SOC2, HIPAA, PCI, OSS];

export function byId(id: string): VerticalTemplate | undefined {
  return ALL.find((t) => t.id === id);
}
