import { complete, type LLMConfig, type ModelTryHook } from "@weft/llm";
import type { Intent, FileLike } from "./classify";

export interface Challenge {
  agrees: boolean;
  challenge: string;
  counterKind?: "trivial" | "sensitive" | "unknown";
  tokensIn: number;
  tokensOut: number;
  model?: string;
}

export interface ChallengeHooks {
  onModelTry?: ModelTryHook;
  onChunk?: (text: string) => void;
}

const SYSTEM = `Você é um revisor cético. Encontre MOTIVOS para DISCORDAR da classificação.

Procure:
- Arquivos "inocentes" que importam código sensível.
- .json/.yaml/.lock que alteram comportamento.
- Configurações com efeitos de segurança.
- Renomeações que quebram contratos.

Responda APENAS com JSON, sem markdown:
{"agrees":true|false,"challenge":"explicação curta","counterKind":"trivial|sensitive|unknown"}`;

const JSON_SCHEMA = {
  name: "adversarial_challenge",
  strict: true,
  schema: {
    type: "object",
    properties: {
      agrees: { type: "boolean" },
      challenge: { type: "string", minLength: 10, maxLength: 500 },
      counterKind: { type: "string", enum: ["trivial", "sensitive", "unknown"] },
    },
    required: ["agrees", "challenge"],
    additionalProperties: false,
  },
};

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

function normalizeKind(v: any): "trivial" | "sensitive" | "unknown" | undefined {
  if (v === null || v === undefined) return undefined;
  let s = String(v).toLowerCase().trim();
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s\-]+/g, "");
  if (["trivial", "low", "safe", "harmless", "minor"].includes(s)) return "trivial";
  if (["sensitive", "sensivel", "high", "risky", "critical"].includes(s)) return "sensitive";
  if (["unknown", "incerto", "unclear", "uncertain", "medium"].includes(s)) return "unknown";
  return undefined;
}

function parseChallenge(raw: string): { agrees: boolean; challenge: string; counterKind?: "trivial" | "sensitive" | "unknown" } | null {
  const obj = tryParseJSON(raw);
  if (!obj) return null;
  const agreesRaw = pickField(obj, ["agrees", "agree", "concorda", "consent"]);
  const challengeRaw = pickField(obj, ["challenge", "message", "reason", "explanation", "desafio", "motivo", "text"]);
  const counterRaw = pickField(obj, ["counterKind", "counter_kind", "suggestion", "suggested", "newKind", "new_kind", "kind"]);
  if (agreesRaw === undefined && !challengeRaw) return null;

  let agrees = false;
  if (typeof agreesRaw === "boolean") agrees = agreesRaw;
  else if (typeof agreesRaw === "string") agrees = /^(true|yes|sim|concord)/i.test(agreesRaw);

  const challenge = challengeRaw
    ? String(challengeRaw).slice(0, 500)
    : agrees ? "revisor concordou (sem texto)" : "revisor discordou (sem texto)";

  const counterKind = normalizeKind(counterRaw);
  return { agrees, challenge, counterKind };
}

export async function challenge(
  cfg: LLMConfig,
  pr: { title: string; body?: string; files: FileLike[] },
  proposed: Intent,
  hooks: ChallengeHooks = {},
): Promise<Challenge> {
  if (!cfg.apiKey) {
    return { agrees: true, challenge: "modo heurístico — sem revisor adversarial", tokensIn: 0, tokensOut: 0 };
  }

  const fileList = pr.files.slice(0, 100)
    .map((f) => `${f.status} ${f.filename} (+${f.additions}/-${f.deletions})`)
    .join("\n");

  const user = `Classificação proposta:
  kind: ${proposed.kind}
  confidence: ${proposed.confidence}
  reasons: ${proposed.reasons.join("; ")}

Título: ${pr.title}
Descrição: ${(pr.body ?? "").slice(0, 500)}

Arquivos:
${fileList}`;

  // adversarial usa um MODELO DIFERENTE do classify (confirmação cruzada real)
  const excludeModels = proposed.model && proposed.model !== "heuristic" ? [proposed.model] : [];
  const streaming = !!hooks.onChunk;

  let res: Awaited<ReturnType<typeof complete>>;
  try {
    res = await complete(cfg, SYSTEM, user, 400, {
      jsonSchema: streaming ? undefined : JSON_SCHEMA,
      stream: streaming,
      onModelTry: hooks.onModelTry,
      onChunk: hooks.onChunk,
      excludeModels,
      stage: "adversarial",
    });
  } catch (e) {
    return {
      agrees: true,
      challenge: `revisor indisponível (${(e as Error).message.slice(0, 80)})`,
      tokensIn: 0, tokensOut: 0,
      model: res?.modelUsed,
    };
  }

  const parsed = parseChallenge(res.text);
  if (!parsed) {
    const lower = res.text.toLowerCase();
    const mentionsTrivial = /\btrivial\b/.test(lower);
    const mentionsSensitive = /\bsensitive\b|\bsensível\b|\bsensivel\b/.test(lower);
    const counterKind =
      proposed.kind !== "trivial" && mentionsTrivial ? "trivial" :
      proposed.kind !== "sensitive" && mentionsSensitive ? "sensitive" :
      undefined;
    return {
      agrees: false,
      challenge: `formato não reconhecido: "${res.text.slice(0, 200)}"`,
      counterKind,
      tokensIn: res.tokensIn, tokensOut: res.tokensOut,
      model: res.modelUsed,
    };
  }

  return {
    agrees: parsed.agrees,
    challenge: parsed.challenge,
    counterKind: parsed.counterKind,
    tokensIn: res.tokensIn, tokensOut: res.tokensOut,
    model: res.modelUsed,
  };
}

export function reconcile(proposed: Intent, c: Challenge): Intent {
  if (c.agrees && !c.counterKind) return proposed;
  if (!c.counterKind) {
    return {
      ...proposed,
      reasons: [...proposed.reasons, `revisor questionou: ${c.challenge.slice(0, 120)}`],
      confidence: Math.min(proposed.confidence, 0.65),
    };
  }

  const rank = { trivial: 0, unknown: 1, sensitive: 2 };
  const finalKind =
    rank[c.counterKind] > rank[proposed.kind]
      ? c.counterKind
      : proposed.kind === "trivial" ? "unknown" : proposed.kind;

  return {
    kind: finalKind,
    reasons: [...proposed.reasons, `revisor discordou: ${c.challenge.slice(0, 200)}`],
    confidence: Math.min(proposed.confidence, 0.6),
    tokensIn: (proposed.tokensIn ?? 0) + c.tokensIn,
    tokensOut: (proposed.tokensOut ?? 0) + c.tokensOut,
    latencyMs: proposed.latencyMs,
    model: proposed.model,
  };
}
