// Descoberta dinâmica de modelos gratuitos do OpenRouter.
// Preferência por famílias conhecidas e confiáveis para classificação.

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture: { output_modalities?: string[]; modality?: string };
  supported_parameters?: string[];
}

export interface FreeModel {
  id: string;
  name: string;
  contextLength: number;
  supportsJsonSchema: boolean;
  supportsJsonMode: boolean;
  score: number;
}

const MIN_SCORE = 3;

// Modelos que NÃO produzem texto útil.
const NON_TEXT_DENYLIST = [
  "lyria", "whisper", "tts", "speech", "music", "audio",
  "image", "vision-encoder", "dall-e", "stable-diffusion",
  "sdxl", "sd-xl", "flux", "playground-v", "recraft",
  "ideogram", "kling", "wan-", "video", "embedding",
  "rerank", "guard", "moderation",
];

// Famílias que historicamente performam bem em classificação estruturada.
// Não é allowlist — só um bônus.
const KNOWN_GOOD_FAMILIES = [
  { pattern: /llama-3\.3?-70b/, bonus: 6 },
  { pattern: /llama-3\.3?-8b/,  bonus: 3 },
  { pattern: /qwen-?2\.5-72b/,  bonus: 6 },
  { pattern: /qwen-?2\.5-32b/,  bonus: 4 },
  { pattern: /qwen3-235b/,      bonus: 6 },
  { pattern: /qwen3-30b/,       bonus: 3 },
  { pattern: /deepseek-r1/,     bonus: 4 },
  { pattern: /deepseek-v3/,     bonus: 6 },
  { pattern: /deepseek-chat/,   bonus: 5 },
  { pattern: /gemini-2\.?[05]?-(flash|pro)/, bonus: 6 },
  { pattern: /gemma-3-27b/,     bonus: 3 },
  { pattern: /mistral-small-3/, bonus: 3 },
  { pattern: /gpt-oss-120b/,    bonus: 5 },
  { pattern: /gpt-oss-20b/,     bonus: 3 },
];

// Famílias ruins para classificação (ou desconhecidas demais).
const KNOWN_WEAK_FAMILIES = [
  { pattern: /nemotron/,     penalty: 6 },
  { pattern: /thinking/,     penalty: 3 },
  { pattern: /reasoning/,    penalty: 3 },
  { pattern: /note-preview/, penalty: 6 },   // modelos experimentais "preview"
  { pattern: /-preview:/,    penalty: 4 },   // qualquer preview
  { pattern: /experimental/, penalty: 4 },
];

let cache: { models: FreeModel[]; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60_000;

export async function discoverFreeModels(apiKey: string): Promise<FreeModel[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.models;

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const r = await fetch("https://openrouter.ai/api/v1/models", { headers });
  if (!r.ok) {
    console.error(`[models] falha ao listar: ${r.status}`);
    return cache?.models ?? [];
  }

  const j = (await r.json()) as { data: OpenRouterModel[] };
  const all = j.data ?? [];

  const scored: FreeModel[] = [];
  let fPrice = 0, fDeny = 0, fMod = 0, fScore = 0;

  for (const m of all) {
    const p = parseFloat(m.pricing?.prompt ?? "0") || 0;
    const c = parseFloat(m.pricing?.completion ?? "0") || 0;
    if (p !== 0 || c !== 0) { fPrice++; continue; }
    if (m.id.startsWith("openrouter/")) { fPrice++; continue; }

    const idLower = m.id.toLowerCase();
    if (NON_TEXT_DENYLIST.some((p) => idLower.includes(p))) { fDeny++; continue; }

    const outMods = m.architecture?.output_modalities;
    if (Array.isArray(outMods) && outMods.length > 0 && !outMods.includes("text")) {
      fMod++; continue;
    }

    const params = m.supported_parameters ?? [];
    const supportsJsonSchema = params.includes("structured_outputs") || params.includes("response_format");
    const supportsJsonMode = params.includes("response_format");

    const score = scoreModel(m, supportsJsonSchema);
    if (score < MIN_SCORE) { fScore++; continue; }

    scored.push({
      id: m.id,
      name: m.name ?? m.id,
      contextLength: m.context_length ?? 0,
      supportsJsonSchema,
      supportsJsonMode,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  cache = { models: scored, at: Date.now() };

  console.log(`[models] ${scored.length} modelos úteis (de ${all.length} totais)`);
  console.log(`  filtrados: ${fPrice} preço, ${fDeny} não-texto, ${fMod} modalidade, ${fScore} score baixo`);
  for (const m of scored.slice(0, 8)) {
    const tag = m.supportsJsonSchema ? "json-schema" : m.supportsJsonMode ? "json-mode" : "text-only";
    console.log(`  ${m.score.toFixed(1).padStart(5)}  ${tag.padEnd(11)}  ${m.id}`);
  }
  if (!scored.length) console.warn("[models] ATENÇÃO: nenhum modelo passou");
  return scored;
}

function scoreModel(m: OpenRouterModel, supportsJsonSchema: boolean): number {
  let score = 0;
  const id = m.id.toLowerCase();
  const name = (m.name ?? "").toLowerCase();

  // contexto
  if (m.context_length >= 128_000) score += 3;
  else if (m.context_length >= 32_000) score += 2;
  else if (m.context_length >= 8_000) score += 1;

  // structured outputs
  if (supportsJsonSchema) score += 5;

  // tamanho do modelo
  if (name.includes("1b") || name.includes("3b") || name.includes("7b")) score -= 3;
  if (name.includes("70b") || name.includes("72b") || name.includes("120b")) score += 2;
  if (name.includes("235b") || name.includes("480b") || name.includes("671b")) score += 3;

  // FAMÍLIAS CONHECIDAS — o filtro principal
  for (const f of KNOWN_GOOD_FAMILIES) {
    if (f.pattern.test(id)) { score += f.bonus; break; }
  }
  for (const f of KNOWN_WEAK_FAMILIES) {
    if (f.pattern.test(id)) { score += -f.penalty; }
  }

  return score;
}

export function getCachedFreeModels(): FreeModel[] {
  return cache?.models ?? [];
}
