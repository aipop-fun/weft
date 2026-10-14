// @weft/llm — multi-provider com streaming, exclusão de modelos e hooks.
import { discoverFreeModels, type FreeModel } from "./models";

export type Provider = "anthropic" | "openrouter";

export interface LLMConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  endpoint: string;
  httpReferer?: string;
  appTitle?: string;
}

export type ModelTryHook = (info: {
  model: string;
  attempt: number;
  total: number;
  stage?: string;
}) => void;

export interface CompleteOpts {
  jsonSchema?: object;
  timeoutMs?: number;
  onModelTry?: ModelTryHook;
  onChunk?: (text: string) => void;
  stage?: string;
  stream?: boolean;
  excludeModels?: string[];
  preferModel?: string;
}

export function loadLLMFromEnv(): LLMConfig {
  const explicit = process.env.LLM_PROVIDER as Provider | undefined;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

  let provider: Provider;
  if (explicit === "openrouter") provider = "openrouter";
  else if (explicit === "anthropic") provider = "anthropic";
  else if (hasOpenRouter && !hasAnthropic) provider = "openrouter";
  else provider = "anthropic";

  if (provider === "openrouter") {
    return {
      provider: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY ?? "",
      model: process.env.OPENROUTER_MODEL ?? "auto-free",
      endpoint: process.env.OPENROUTER_ENDPOINT ?? "https://openrouter.ai/api/v1/chat/completions",
      httpReferer: process.env.OPENROUTER_REFERER,
      appTitle: process.env.OPENROUTER_TITLE ?? "Weft",
    };
  }

  return {
    provider: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.WEFT_MODEL ?? "claude-sonnet-4-5",
    endpoint: process.env.ANTHROPIC_ENDPOINT ?? "https://api.anthropic.com/v1/messages",
  };
}

export interface LLMResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  modelUsed?: string;
}

let freeModelCache: FreeModel[] = [];
let freeModelCacheAt = 0;
const MODEL_TIMEOUT_MS = Number(process.env.WEFT_MODEL_TIMEOUT_MS ?? 6000);

async function pickFreeModels(cfg: LLMConfig): Promise<FreeModel[]> {
  if (cfg.model !== "auto-free" && cfg.model !== "openrouter/free") {
    return [{
      id: cfg.model, name: cfg.model, contextLength: 0,
      supportsJsonSchema: false, supportsJsonMode: false, score: 100,
    }];
  }
  if (Date.now() - freeModelCacheAt < 5 * 60_000 && freeModelCache.length) {
    return freeModelCache;
  }
  const models = await discoverFreeModels(cfg.apiKey);
  freeModelCache = models.slice(0, 6);
  freeModelCacheAt = Date.now();
  return freeModelCache;
}

export async function complete(
  cfg: LLMConfig,
  system: string,
  user: string,
  maxTokens = 512,
  opts: CompleteOpts = {},
): Promise<LLMResult> {
  if (!cfg.apiKey) {
    throw new Error(cfg.provider === "openrouter"
      ? "OPENROUTER_API_KEY não configurado"
      : "ANTHROPIC_API_KEY não configurado");
  }
  if (cfg.provider === "openrouter") return completeOpenRouter(cfg, system, user, maxTokens, opts);
  return completeAnthropic(cfg, system, user, maxTokens);
}

async function completeAnthropic(
  cfg: LLMConfig, system: string, user: string, maxTokens: number,
): Promise<LLMResult> {
  const r = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model, max_tokens: maxTokens, system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${await r.text()}`);
  const j = await r.json() as {
    content: Array<{ type: string; text?: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };
  const text = j.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  return { text, tokensIn: j.usage.input_tokens, tokensOut: j.usage.output_tokens, modelUsed: cfg.model };
}

async function completeOpenRouter(
  cfg: LLMConfig,
  system: string,
  user: string,
  maxTokens: number,
  opts: CompleteOpts,
): Promise<LLMResult> {
  let candidates = await pickFreeModels(cfg);
  if (!candidates.length) throw new Error("nenhum modelo gratuito usável no momento");

  if (opts.excludeModels?.length) {
    const banned = new Set(opts.excludeModels);
    candidates = candidates.filter((m) => !banned.has(m.id));
  }
  if (!candidates.length) throw new Error("todos os modelos foram excluídos");

  if (opts.preferModel) {
    candidates.sort((a, b) => (b.id === opts.preferModel ? 1 : 0) - (a.id === opts.preferModel ? 1 : 0));
  }

  const timeoutMs = opts.timeoutMs ?? MODEL_TIMEOUT_MS;
  const errors: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i];
    opts.onModelTry?.({ model: m.id, attempt: i + 1, total: candidates.length, stage: opts.stage });

    const result = await tryOneModel(cfg, m, system, user, maxTokens, opts, timeoutMs);
    if (result.ok) {
      if (i > 0) console.log(`[llm] fallback: usei ${m.id} na tentativa ${i + 1}`);
      return result.value;
    }
    errors.push(`${m.id}: ${result.error}`);
    if (result.error.includes("402")) throw new Error(result.error);
    if (result.error.includes("429")) await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`todos os ${candidates.length} modelos falharam:\n${errors.join("\n")}`);
}

async function tryOneModel(
  cfg: LLMConfig,
  m: FreeModel,
  system: string,
  user: string,
  maxTokens: number,
  opts: CompleteOpts,
  timeoutMs: number,
): Promise<{ ok: true; value: LLMResult } | { ok: false; error: string }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.httpReferer) headers["HTTP-Referer"] = cfg.httpReferer;
  if (cfg.appTitle) headers["X-Title"] = cfg.appTitle;

  const streaming = opts.stream === true;
  const body: Record<string, unknown> = {
    model: m.id,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (streaming) {
    body.stream = true;
  } else if (opts.jsonSchema && m.supportsJsonSchema) {
    body.response_format = { type: "json_schema", json_schema: opts.jsonSchema };
  } else if (m.supportsJsonMode) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let r: Response;
  try {
    r = await fetch(cfg.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = (e as Error).name === "AbortError"
      ? `timeout após ${timeoutMs}ms`
      : `network: ${(e as Error).message}`;
    return { ok: false, error: msg };
  }
  clearTimeout(timer);

  if (r.status === 429) return { ok: false, error: "429 rate limited" };
  if (r.status === 402) return { ok: false, error: "402 payment required" };
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { ok: false, error: `${r.status}: ${t.slice(0, 200)}` };
  }

  if (streaming && r.body) {
    return await consumeStream(r, m, opts);
  }

  const j = await r.json() as {
    model?: string;
    choices?: Array<{ message: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = j.choices?.[0]?.message?.content ?? "";
  if (!text) return { ok: false, error: "resposta vazia" };
  return {
    ok: true,
    value: {
      text,
      tokensIn: j.usage?.prompt_tokens ?? 0,
      tokensOut: j.usage?.completion_tokens ?? 0,
      modelUsed: j.model ?? m.id,
    },
  };
}

async function consumeStream(
  r: Response, m: FreeModel, opts: CompleteOpts,
): Promise<{ ok: true; value: LLMResult } | { ok: false; error: string }> {
  const reader = r.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let full = "";
  let modelUsed = m.id;
  let tokensIn = 0, tokensOut = 0;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t || !t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          if (j.model) modelUsed = j.model;
          if (j.usage) {
            tokensIn = j.usage.prompt_tokens ?? tokensIn;
            tokensOut = j.usage.completion_tokens ?? tokensOut;
          }
          const delta = j.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) {
            full += delta;
            opts.onChunk?.(delta);
          }
        } catch {}
      }
    }
  } catch (e) {
    return { ok: false, error: `stream: ${(e as Error).message}` };
  }

  if (!full) return { ok: false, error: "stream vazio" };
  return { ok: true, value: { text: full, tokensIn, tokensOut, modelUsed } };
}
