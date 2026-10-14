export const HARD_PATHS = [
  "auth/", "security/", "crypto/", "billing/", "payments/",
  "migrations/", "secrets/", ".github/workflows/",
  "infra/", "terraform/", "k8s/", "helm/",
];

export function hitsHardPath(files: Array<{ filename: string }>): string | null {
  for (const f of files) {
    for (const p of HARD_PATHS) {
      if (f.filename.startsWith(p) || f.filename.includes("/" + p)) return f.filename;
    }
  }
  return null;
}
