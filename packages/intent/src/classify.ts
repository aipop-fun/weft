import { complete, type LLMConfig, type ModelTryHook } from "@weft/llm";

export type IntentKind = "trivial" | "sensitive" | "unknown";

export interface Intent {
  kind: IntentKind;
  reasons: string[];
  confidence: number;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  model: string;
  raw?: string;
}

export interface FileLike {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

export interface ClassifyHooks {
  onModelTry?: ModelTryHook;
  onChunk?: (text: string) => void;
}

const JSON_SCHEMA = {
  name: "intent_classification",
  strict: true,
  schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["trivial", "sensitive", "unknown"] },
      reasons: { type: "array", items: { type: "string", minLength: 8 }, minItems: 2, maxItems: 5 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["kind", "reasons", "confidence"],
    additionalProperties: false,
  },
};

const SYSTEM = `Você classifica pull requests por risco.

Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois.

Regras:
- "trivial": docs (.md, .txt), comentários, formatação, lockfiles, dependabot bumps triviais, testes que só adicionam cobertura.
- "sensitive": lógica de negócio, autenticação, criptografia, pagamento, infraestrutura, migrações, API pública, config de segurança.
- "unknown": qualquer coisa que não é obviamente uma das duas.
- Seja CONSERVADOR. Na dúvida, use "unknown".
- Se a confiança for menor que 0.7, use "unknown".

Motivos: escreva 2 a 5 motivos CONCRETOS citando o que você viu.
PROIBIDO: "unsure", "not sure", "não tenho certeza", "incerto".

FORMATO EXATO: {"kind":"trivial|sensitive|unknown","reasons":["..."],"confidence":0.0}`;

const SENSITIVE_PREFIXES = [
  "auth/", "security/", "crypto/", "billing/", "payments/",
  "migrations/", "secrets/", ".github/workflows/", "infra/",
  "terraform/", "k8s/", "helm/",
];
const TRIVIAL_SUFFIXES = [".md", ".txt", ".lock", ".mdx"];

function heuristicClassify(pr: { title: string; body?: string; author: string; files: FileLike[] }): Intent {
  const reasons: string[] = [];
  let sensitive = false;
  let allTrivial = true;
  for (const f of pr.files) {
    const name = f.filename;
    if (SENSITIVE_PREFIXES.some((p) => name.startsWith(p) || name.includes("/" + p))) {
      sensitive = true;
      reasons.push(`path sensível: ${name}`);
    }
    const looksTrivial = TRIVIAL_SUFFIXES.some((s) => name.endsWith(s));
    const isDepBot = /dependabot|renovate/i.test(pr.author);
    const isLockfile = name.endsWith(".lock") || name.endsWith("package-lock.json") ||
      name.endsWith("yarn.lock") || name.endsWith("pnpm-lock.yaml") || name.endsWith("bun.lockb");
    if (!looksTrivial && !isDepBot && !isLockfile) allTrivial = false;
  }
  if (sensitive) return { kind: "sensitive", reasons, confidence: 0.85, model: "heuristic" };
  if (allTrivial) return { kind: "trivial", reasons: ["apenas arquivos triviais"], confidence: 0.85, model: "heuristic" };
  return { kind: "unknown", reasons: ["modo heurístico sem LLM"], confidence: 0.4, model: "heuristic" };
}

function balancedJSONSlice(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return null;
}

function tryParseJSON(s: string): any | null {
  if (!s) return null;
  const slice = balancedJSONSlice(s);
  if (!slice) return null;
  try { return JSON.parse(slice); } catch {}
  try {
    const fixed = slice
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/([{,]\s*)'([^']*)'\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*)'/g, ': "$1"');
    return JSON.parse(fixed);
  } catch {}
  return null;
}

const KIND_ALIASES: Record<string, IntentKind> = {
  trivial: "trivial", triviality: "trivial", low: "trivial", safe: "trivial",
  harmless: "trivial", minor: "trivial", docs: "trivial", documentation: "trivial",
  cosmetic: "trivial", nonfunctional: "trivial", non_functional: "trivial",
  sensitive: "sensitive", sensivel: "sensitive", high: "sensitive", risky: "sensitive",
  critical: "sensitive", danger: "sensitive", dangerous: "sensitive",
  security: "sensitive", important: "sensitive", major: "sensitive",
  unknown: "unknown", uncertain: "unknown", unclear: "unknown", ambiguous: "unknown",
  medium: "unknown", moderate: "unknown", unknownrisk: "unknown", unknown_risk: "unknown",
  incerto: "unknown", desconhecido: "unknown",
};

function normalizeKindValue(v: any): IntentKind | null {
  if (v === null || v === undefined) return null;
  let s = String(v).toLowerCase().trim();
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s\-]+/g, "").replace(/[^a-z_]/g, "");
  return KIND_ALIASES[s] ?? null;
}

const KIND_FIELD_ALIASES = [
  "kind", "classification", "category", "type", "label",
  "risk", "risklevel", "risk_level", "class", "tipo", "categoria",
];
const CONFIDENCE_FIELD_ALIASES = ["confidence", "score", "probability", "certainty", "confianca"];
const REASONS_FIELD_ALIASES = [
  "reasons", "reasoning", "reason", "explanation", "notes", "note",
  "justification", "motivos", "motivo", "razoes", "razao", "why",
];

function pickField(obj: any, aliases: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  const keys = Object.keys(obj);
  for (const a of aliases) {
    if (keys.includes(a)) return obj[a];
    const k = keys.find((x) => x.toLowerCase() === a.toLowerCase());
    if (k) return obj[k];
  }
  return undefined;
}

function normalizeConfidenceValue(v: any): number {
  let n = Number(v);
  if (isNaN(n)) {
    const m = String(v).match(/(\d+\.?\d*)/);
    if (!m) return 0;
    n = parseFloat(m[1]);
  }
  if (n > 1) n = n / 100;
  return Math.max(0, Math.min(1, n));
}

const LAZY_PATTERNS = [
  /^unsure/i, /^uncertain/i, /^not sure/i,
  /^classifica[çc][aã]o incerta/i, /^incerto$/i,
  /^n[ãa]o (tenho|posso|sei)/i, /an[áa]lise inconclusiva/i,
  /^ambiguous/i, /^unknown$/i, /^incertain$/i,
];

function isLazyReason(r: string): boolean {
  const s = r.trim();
  if (s.length < 8) return true;
  return LAZY_PATTERNS.some((p) => p.test(s));
}

function normalizeReasonsValue(v: any): string[] {
  let arr: string[] = [];
  if (Array.isArray(v)) {
    arr = v.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const r = item.reason ?? item.text ?? item.message ?? item.description;
        if (typeof r === "string") return [r];
      }
      return [String(item)];
    });
  } else if (typeof v === "string") {
    arr = v.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
  } else if (v && typeof v === "object") {
    arr = Object.values(v).filter((x) => typeof x === "string") as string[];
  }
  return arr.map((r) => r.trim()).filter((r) => r.length > 0 && !isLazyReason(r)).slice(0, 5);
}

interface ParsedIntent { kind: IntentKind; confidence: number; reasons: string[]; source: string }

function extractFromObject(obj: any, source: string): ParsedIntent | null {
  if (!obj || typeof obj !== "object") return null;
  for (const f of KIND_FIELD_ALIASES) {
    const v = pickField(obj, [f]);
    if (v !== undefined) {
      const k = normalizeKindValue(v);
      if (k) {
        const conf = normalizeConfidenceValue(pickField(obj, CONFIDENCE_FIELD_ALIASES) ?? 0);
        const reasons = normalizeReasonsValue(pickField(obj, REASONS_FIELD_ALIASES));
        return { kind: k, confidence: conf, reasons, source };
      }
    }
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = extractFromObject(v, `${source}.${k}`);
      if (nested) return nested;
    }
  }
  return null;
}

function extractFromText(raw: string): ParsedIntent | null {
  if (!raw) return null;
  const labelRe = new RegExp(`\\b(?:${KIND_FIELD_ALIASES.join("|")})\\s*[:=]\\s*["']?([a-z_]+)`, "i");
  const lm = raw.match(labelRe);
  if (lm) {
    const k = normalizeKindValue(lm[1]);
    if (k) return { kind: k, confidence: 0.4, reasons: [`extraído: "${lm[0]}"`], source: "regex-label" };
  }
  const enumRe = /\b(trivial|sensitive|unknown|sensível|sensivel|incerto|desconhecido)\b/i;
  const em = raw.match(enumRe);
  if (em) {
    const k = normalizeKindValue(em[1]);
    if (k) return { kind: k, confidence: 0.3, reasons: [`menciona "${em[1]}"`], source: "regex-enum" };
  }
  return null;
}

function parseResponse(raw: string): ParsedIntent | null {
  const obj = tryParseJSON(raw);
  if (obj) {
    const p = extractFromObject(obj, "json");
    if (p) return p;
  }
  const cleaned = raw.replace(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/g, "$1").trim();
  if (cleaned !== raw) {
    const obj2 = tryParseJSON(cleaned);
    if (obj2) {
      const p = extractFromObject(obj2, "json-clean");
      if (p) return p;
    }
  }
  return extractFromText(raw);
}

export async function classify(
  cfg: LLMConfig,
  pr: { title: string; body?: string; author: string; files: FileLike[] },
  hooks: ClassifyHooks = {},
): Promise<Intent> {
  if (!cfg.apiKey) return heuristicClassify(pr);

  const fileList = pr.files.slice(0, 100)
    .map((f) => `${f.status} ${f.filename} (+${f.additions}/-${f.deletions})`)
    .join("\n");

  const user = `Título: ${pr.title}
Autor: ${pr.author}
Descrição: ${(pr.body ?? "").slice(0, 800)}
Total de arquivos: ${pr.files.length}

Arquivos:
${fileList}`;

  const streaming = !!hooks.onChunk;
  const t0 = Date.now();
  let res: Awaited<ReturnType<typeof complete>>;
  try {
    res = await complete(cfg, SYSTEM, user, 800, {
      jsonSchema: streaming ? undefined : JSON_SCHEMA,
      stream: streaming,
      onModelTry: hooks.onModelTry,
      onChunk: hooks.onChunk,
      stage: "classify",
    });
  } catch (e) {
    console.error("[classify] todos os modelos falharam:", (e as Error).message);
    return heuristicClassify(pr);
  }
  const latencyMs = Date.now() - t0;

  const parsed = parseResponse(res.text);
  if (!parsed) {
    console.warn("[classify] parse falhou. raw:", JSON.stringify(res.text.slice(0, 200)));
    const h = heuristicClassify(pr);
    return {
      ...h,
      reasons: [...h.reasons, `modelo devolveu formato irreconhecível`],
      model: res.modelUsed ?? cfg.model,
      tokensIn: res.tokensIn, tokensOut: res.tokensOut, latencyMs,
      raw: res.text.slice(0, 500),
    };
  }

  let finalKind = parsed.kind;
  const confidence = parsed.confidence;
  const reasons = parsed.reasons.length ? parsed.reasons : [`modelo: ${res.modelUsed ?? cfg.model}`];
  if (confidence < 0.7 && finalKind !== "unknown") finalKind = "unknown";

  return {
    kind: finalKind, reasons, confidence,
    tokensIn: res.tokensIn, tokensOut: res.tokensOut, latencyMs,
    model: res.modelUsed ?? cfg.model,
    raw: res.text.slice(0, 500),
  };
}
