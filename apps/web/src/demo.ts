import { classify } from "@weft/intent";
import { challenge, reconcile } from "@weft/intent/adversarial";
import { loadLLMFromEnv, type ModelTryHook } from "@weft/llm";

const llm = loadLLMFromEnv();

function json(v: unknown, status = 200): Response {
  return new Response(JSON.stringify(v, null, 2), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "weft-demo",
  };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// ---------- cache por PR (head_sha) ----------
interface CachedResult { at: number; payload: any }
const demoCache = new Map<string, CachedResult>();
const CACHE_TTL_MS = 30 * 60_000;

function cacheKey(owner: string, repo: string, num: number, sha: string): string {
  return `${owner}/${repo}#${num}@${sha}`;
}

function cacheGet(key: string): any | null {
  const e = demoCache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) { demoCache.delete(key); return null; }
  return e.payload;
}

function cacheSet(key: string, payload: any): void {
  demoCache.set(key, { at: Date.now(), payload });
  if (demoCache.size > 200) {
    const firstKey = demoCache.keys().next().value;
    if (firstKey) demoCache.delete(firstKey);
  }
}

// ---------- rate limit por IP ----------
const ipHits = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5; // 5 PRs/min por IP

function rateAllow(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

// ---------- SSE ----------
type EventPayload = Record<string, unknown>;

class SSEStream {
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private stream: ReadableStream<Uint8Array>;
  private encoder = new TextEncoder();
  private closed = false;

  constructor() {
    this.stream = new ReadableStream({ start: (c) => { this.controller = c; } });
  }

  send(type: string, data: EventPayload): void {
    if (this.closed || !this.controller) return;
    const payload = JSON.stringify({ type, at: Date.now(), ...data });
    try { this.controller.enqueue(this.encoder.encode(`data: ${payload}\n\n`)); } catch {}
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try { this.controller?.close(); } catch {}
  }

  response(): Response {
    return new Response(this.stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        "connection": "keep-alive",
        "access-control-allow-origin": "*",
        "x-accel-buffering": "no",
      },
    });
  }
}

// ---------- rota principal ----------
export function demoStreamRoute(req: Request): Response {
  const url = new URL(req.url);
  const pr = url.searchParams.get("pr");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const sse = new SSEStream();

  if (!rateAllow(ip)) {
    sse.send("fatal", { message: `rate limit: máximo ${RATE_MAX} PRs por minuto por IP` });
    sse.close();
    return sse.response();
  }

  queueMicrotask(async () => {
    try {
      if (!pr) { sse.send("fatal", { message: "use ?pr=owner/repo#123" }); sse.close(); return; }
      const m = pr.match(/^([^/]+)\/([^#]+)#(\d+)$/);
      if (!m) { sse.send("fatal", { message: "formato: owner/repo#number" }); sse.close(); return; }
      const [, owner, repo, numStr] = m;
      const num = Number(numStr);

      sse.send("step", { id: "fetch", status: "running", label: "Buscando PR no GitHub", detail: `${owner}/${repo}#${num}` });
      const api = "https://api.github.com";
      const headers = ghHeaders();

      const prResp = await fetch(`${api}/repos/${owner}/${repo}/pulls/${num}`, { headers });
      if (prResp.status === 404) {
        sse.send("step", { id: "fetch", status: "error", label: "PR não encontrado", detail: "" });
        sse.send("fatal", { message: `PR ${owner}/${repo}#${num} não encontrado` });
        sse.close(); return;
      }
      if (prResp.status === 403 || prResp.status === 429) {
        sse.send("fatal", { message: "rate limit do GitHub — adicione GITHUB_TOKEN" });
        sse.close(); return;
      }
      if (!prResp.ok) { sse.send("fatal", { message: `github ${prResp.status}` }); sse.close(); return; }

      const prData = (await prResp.json()) as { title: string; body: string | null; user: { login: string }; head: { sha: string } };
      const headSha = prData.head?.sha ?? String(Date.now());

      const filesResp = await fetch(`${api}/repos/${owner}/${repo}/pulls/${num}/files?per_page=100`, { headers });
      if (!filesResp.ok) { sse.send("fatal", { message: `github files ${filesResp.status}` }); sse.close(); return; }
      const files = (await filesResp.json()) as Array<{
        filename: string; status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
        additions: number; deletions: number; changes: number; patch?: string;
      }>;
      const additions = files.reduce((a, f) => a + f.additions, 0);
      const deletions = files.reduce((a, f) => a + f.deletions, 0);

      sse.send("step", { id: "fetch", status: "done", label: "PR carregado", detail: `${files.length} arquivos, +${additions}/-${deletions}` });
      sse.send("pr", {
        spec: `${owner}/${repo}#${num}`,
        title: prData.title,
        author: prData.user.login,
        files: files.map((f) => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions })),
      });

      // ---------- cache hit ----------
      const key = cacheKey(owner, repo, num, headSha);
      const cached = cacheGet(key);
      if (cached) {
        sse.send("step", { id: "classify", status: "done", label: "Cache hit", detail: "resultado reaproveitado" });
        sse.send("step", { id: "adversarial", status: "done", label: "Cache hit", detail: "" });
        sse.send("step", { id: "reconcile", status: "done", label: "Cache hit", detail: "" });
        sse.send("step", { id: "decide", status: "done", label: "Cache hit", detail: "" });
        sse.send("result", { ...cached, cached: true });
        sse.send("done", {});
        sse.close();
        return;
      }

      // ---------- classify ----------
      sse.send("step", { id: "classify", status: "running", label: "Classificando intent", detail: `provider: ${llm.provider}` });
      sse.send("llm-request", {
        stage: "classify",
        model: llm.model,
        system: "Você classifica pull requests por risco. Responda APENAS com JSON válido.",
        user: buildClassifyUser(prData, files),
      });

      const t0 = Date.now();
      const proposed = await classify(llm, {
        title: prData.title, body: prData.body ?? "", author: prData.user.login, files,
      }, {
        onModelTry: (info: Parameters<ModelTryHook>[0]) => sse.send("model-try", { stage: "classify", ...info }),
        onChunk: (text: string) => sse.send("chunk", { stage: "classify", text }),
      });
      const classifyMs = Date.now() - t0;

      sse.send("step", {
        id: "classify", status: "done",
        label: `Classificado: ${proposed.kind}`,
        detail: `confiança ${(proposed.confidence * 100).toFixed(0)}% · ${classifyMs}ms · ${proposed.model}`,
      });
      sse.send("llm-response", {
        stage: "classify",
        text: proposed.reasons.join("\n") || "(sem motivos)",
        intent: proposed, latencyMs: classifyMs, modelUsed: proposed.model,
      });

      // ---------- adversarial ----------
      sse.send("step", { id: "adversarial", status: "running", label: "Revisor adversarial", detail: "modelo diferente do classify" });
      sse.send("llm-request", {
        stage: "adversarial",
        model: "(modelo diferente)",
        system: "Você é um revisor cético. Encontre MOTIVOS para DISCORDAR.",
        user: buildAdversarialUser(prData, files, proposed),
      });

      const t1 = Date.now();
      const chal = await challenge(
        llm,
        { title: prData.title, body: prData.body ?? "", files },
        proposed,
        {
          onModelTry: (info: Parameters<ModelTryHook>[0]) => sse.send("model-try", { stage: "adversarial", ...info }),
          onChunk: (text: string) => sse.send("chunk", { stage: "adversarial", text }),
        },
      );
      const adversarialMs = Date.now() - t1;

      sse.send("step", {
        id: "adversarial", status: "done",
        label: chal.agrees ? "Revisor concordou" : "Revisor discordou",
        detail: `${adversarialMs}ms · ${chal.model ?? "?"}`,
      });
      sse.send("llm-response", {
        stage: "adversarial",
        text: chal.challenge,
        agrees: chal.agrees, counterKind: chal.counterKind,
        latencyMs: adversarialMs, modelUsed: chal.model,
      });

      // ---------- reconcile ----------
      sse.send("step", { id: "reconcile", status: "running", label: "Reconciliando", detail: "" });
      const final = reconcile(proposed, chal);
      sse.send("step", {
        id: "reconcile", status: "done",
        label: `Decisão final: ${final.kind}`,
        detail: chal.agrees ? "revisor concordou — mantido" : `rebaixado para ${final.kind}`,
      });

      // ---------- decide ----------
      sse.send("step", { id: "decide", status: "running", label: "Aplicando regras", detail: "" });
      const hardPath = hitHardPath(files.map((f) => f.filename));
      const decision = hardPath
        ? { action: "request_human", reason: `path sensível (${hardPath}) — sempre humano`, requiredHuman: 1 }
        : final.kind === "trivial"
          ? { action: "approve", reason: "PR trivial, sem regra bloqueante", requiredHuman: 0 }
          : { action: "request_human", reason: final.kind === "sensitive" ? "PR sensível" : "classificação incerta", requiredHuman: 1 };

      sse.send("step", {
        id: "decide", status: "done",
        label: decision.action === "approve" ? "Aprovaria automaticamente" : "Escalaria para humano",
        detail: decision.reason,
      });

      const payload = {
        pr: `${owner}/${repo}#${num}`,
        title: prData.title,
        author: prData.user.login,
        proposed, challenge: chal, final, decision,
        latencyMs: Date.now() - t0,
      };
      cacheSet(key, payload);
      sse.send("result", payload);
      sse.send("done", {});
      sse.close();
    } catch (e) {
      sse.send("fatal", { message: (e as Error).message });
      sse.close();
    }
  });

  return sse.response();
}

function buildClassifyUser(pr: { title: string; body: string | null; user: { login: string } }, files: any[]): string {
  const fileList = files.slice(0, 100).map((f) => `${f.status} ${f.filename} (+${f.additions}/-${f.deletions})`).join("\n");
  return `Título: ${pr.title}\nAutor: ${pr.user.login}\nDescrição: ${(pr.body ?? "").slice(0, 800)}\nTotal de arquivos: ${files.length}\n\nArquivos:\n${fileList}`;
}

function buildAdversarialUser(pr: { title: string; body: string | null }, files: any[], proposed: any): string {
  const fileList = files.slice(0, 100).map((f) => `${f.status} ${f.filename} (+${f.additions}/-${f.deletions})`).join("\n");
  return `Classificação proposta:\n  kind: ${proposed.kind}\n  confidence: ${proposed.confidence}\n  reasons: ${proposed.reasons.join("; ")}\n\nTítulo: ${pr.title}\nDescrição: ${(pr.body ?? "").slice(0, 500)}\n\nArquivos:\n${fileList}`;
}

const HARD_PATHS = [
  "auth/", "security/", "crypto/", "billing/", "payments/",
  "migrations/", "secrets/", ".github/workflows/",
  "infra/", "terraform/", "k8s/", "helm/",
];

function hitHardPath(files: string[]): string | null {
  for (const f of files) {
    for (const p of HARD_PATHS) {
      if (f.startsWith(p) || f.includes("/" + p)) return f;
    }
  }
  return null;
}

// ---------- lista PRs ----------
export async function demoListRoute(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const repo = url.searchParams.get("repo");
  if (!repo) return json({ error: "use ?repo=owner/repo" }, 400);
  const headers = ghHeaders();
  const r = await fetch(
    `https://api.github.com/repos/${repo}/pulls?state=all&per_page=10&sort=updated&direction=desc`,
    { headers },
  );
  if (!r.ok) return json({ error: `github ${r.status}` }, r.status);
  const prs = (await r.json()) as Array<{
    number: number; title: string; user: { login: string }; state: string; draft: boolean;
  }>;
  return json(prs.map((p) => ({
    spec: `${repo}#${p.number}`, number: p.number,
    title: p.title, author: p.user.login, state: p.state, draft: p.draft,
  })));
}

// ---------- HTML ----------
export const DEMO_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weft — Demo</title>
<style>
  :root{--bg:#0a0a0b;--fg:#e5e5e7;--mut:#a1a1aa;--acc:#7dd3fc;--ok:#86efac;--warn:#fcd34d;--bad:#fca5a5;--panel:#131316;--border:#26262a}
  *{box-sizing:border-box}
  body{margin:0;font:15px/1.6 system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg)}
  header{padding:16px 24px;border-bottom:1px solid var(--border);display:flex;align-items:baseline;gap:24px}
  header a{color:var(--fg);text-decoration:none;font-weight:600}
  header nav a{color:var(--mut);font-weight:400;margin-left:16px}
  main{max-width:960px;margin:0 auto;padding:48px 24px}
  h1{font-size:24px;margin:0 0 8px}
  .sub{color:var(--mut);margin-bottom:32px}
  .input-row{display:flex;gap:8px;margin-bottom:24px}
  input{flex:1;padding:12px 16px;background:var(--panel);border:1px solid var(--border);border-radius:8px;color:var(--fg);font:inherit}
  input:focus{outline:none;border-color:var(--acc)}
  button{padding:12px 24px;background:var(--acc);color:#0a0a0b;border:none;border-radius:8px;font-weight:600;cursor:pointer;font:inherit}
  button:disabled{opacity:0.5;cursor:wait}
  .ex{color:var(--mut);font-size:13px;margin-top:8px}
  .ex a{color:var(--acc);cursor:pointer;text-decoration:none;margin-right:12px}
  .ex a:hover{text-decoration:underline}
  .timeline{margin-top:32px;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px;display:none}
  .timeline.show{display:block}
  .stage{padding:14px 0;border-bottom:1px solid #1a1a1e;display:flex;gap:14px;align-items:flex-start}
  .stage:last-child{border-bottom:none}
  .stage .icon{width:22px;height:22px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px;border-radius:50%;margin-top:2px}
  .stage.running .icon{background:#1e3a5f;color:var(--acc);animation:pulse 1.2s infinite}
  .stage.done .icon{background:#052e16;color:var(--ok)}
  .stage.error .icon{background:#450a0a;color:var(--bad)}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .stage .body{flex:1;min-width:0}
  .stage .label{font-weight:500}
  .stage .detail{color:var(--mut);font-size:13px;margin-top:2px}
  .stage .meta{color:#52525b;font-size:11px;font-family:ui-monospace,monospace;margin-top:4px}
  .payload{margin-top:8px;background:#0a0a0b;border:1px solid #1a1a1e;border-radius:6px;padding:10px 12px;font-family:ui-monospace,monospace;font-size:12px;color:#a1a1aa;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow-y:auto}
  .payload.response{color:#d4d4d8;border-color:#1e3a5f}
  .payload.live{color:#fff;border-color:#3b82f6;background:#0a1628}
  .payload.live::after{content:"▊";color:#7dd3fc;animation:pulse 0.8s infinite}
  .payload.tries{color:#7dd3fc;border-color:#1e3a5f;max-height:120px}
  .verdict{margin-top:24px;padding:20px;border-radius:10px;border:1px solid var(--border);display:none}
  .verdict.show{display:block}
  .verdict.approve{background:#052e16;border-color:#14532d}
  .verdict.request_human{background:#422006;border-color:#78350f}
  .verdict h2{margin:0 0 12px;font-size:20px}
  .verdict .row{display:flex;gap:12px;margin-bottom:6px;font-size:14px}
  .verdict .row b{width:130px;color:rgba(255,255,255,0.5);font-weight:400;flex-shrink:0}
  .verdict .reasons{margin-top:12px;padding-left:20px;font-size:13px}
  .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:500}
  .badge.trivial{background:#052e16;color:#86efac}
  .badge.sensitive{background:#450a0a;color:#fca5a5}
  .badge.unknown{background:#422006;color:#fcd34d}
  .tag{display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;background:#1e3a5f;color:#7dd3fc;margin-left:6px}
  details{margin-top:12px}
  details summary{cursor:pointer;color:var(--mut);font-size:12px}
  details pre{background:#0a0a0b;padding:16px;border-radius:8px;overflow-x:auto;font-size:11px;color:#a1a1aa;max-height:400px}
</style>
</head>
<body>
<header>
  <a href="/">weft</a>
  <nav><a href="/demo">Demo</a><a href="/dashboard">Dashboard</a><a href="/docs">Docs</a></nav>
</header>
<main>
  <h1>Classifique qualquer PR público</h1>
  <p class="sub">Veja o raciocínio do Weft em tempo real — classificação, revisor adversarial com modelo diferente, e cache por PR.</p>
  <div class="input-row">
    <input id="pr" placeholder="owner/repo#123  ou  https://github.com/owner/repo/pull/123" autofocus>
    <button id="run">Analisar</button>
  </div>
  <p class="ex">Exemplos:
    <a data-pr="vercel/next.js#71000">vercel/next.js</a>
    <a data-repo="microsoft/vscode">listar PRs do vscode</a>
    <a data-repo="oven-sh/bun">listar PRs do bun</a>
  </p>
  <div id="timeline" class="timeline"></div>
  <div id="verdict" class="verdict"></div>
</main>
<script>
var tl = document.getElementById('timeline');
var verdict = document.getElementById('verdict');
var prInput = document.getElementById('pr');
var runBtn = document.getElementById('run');
var stageEls = new Map();
var chunkBuffers = new Map();

function ensureStage(id, label) {
  if (stageEls.has(id)) return stageEls.get(id);
  var el = document.createElement('div');
  el.className = 'stage running';
  el.innerHTML = '<div class="icon">○</div>' +
    '<div class="body">' +
      '<div class="label">' + label + '</div>' +
      '<div class="detail"></div>' +
      '<div class="meta"></div>' +
      '<div class="payload-slot"></div>' +
    '</div>';
  tl.appendChild(el);
  stageEls.set(id, el);
  return el;
}

function updateStage(id, status, label, detail) {
  var el = stageEls.get(id);
  if (!el) return;
  el.className = 'stage ' + status;
  var icon = el.querySelector('.icon');
  icon.textContent = status === 'done' ? '✓' : status === 'error' ? '✗' : '○';
  if (label) el.querySelector('.label').textContent = label;
  if (detail !== undefined) el.querySelector('.detail').textContent = detail;
  el.querySelector('.meta').textContent = new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

function addPayload(id, kind, content) {
  var el = stageEls.get(id);
  if (!el) return null;
  var slot = el.querySelector('.payload-slot');
  var div = document.createElement('div');
  div.className = 'payload' + (kind === 'response' ? ' response' : kind === 'tries' ? ' tries' : kind === 'live' ? ' live' : '');
  div.textContent = content;
  slot.appendChild(div);
  return div;
}

function appendTry(id, text) {
  var el = stageEls.get(id);
  if (!el) return;
  var tries = el.querySelector('.payload.tries');
  if (!tries) {
    tries = document.createElement('div');
    tries.className = 'payload tries';
    el.querySelector('.payload-slot').appendChild(tries);
  }
  tries.textContent += (tries.textContent ? '\\n' : '') + text;
}

function appendChunk(id, text) {
  var el = stageEls.get(id);
  if (!el) return;
  var buf = (chunkBuffers.get(id) || '') + text;
  chunkBuffers.set(id, buf);
  var live = el.querySelector('.payload.live');
  if (!live) {
    live = document.createElement('div');
    live.className = 'payload live';
    el.querySelector('.payload-slot').appendChild(live);
  }
  live.textContent = buf;
  live.scrollTop = live.scrollHeight;
}

function freezeChunk(id) {
  var el = stageEls.get(id);
  if (!el) return;
  var live = el.querySelector('.payload.live');
  if (live) live.classList.remove('live');
}

async function run() {
  var input = prInput.value.trim();
  var spec = input;
  var m = input.match(/github\\.com\\/([^/]+)\\/([^/]+)\\/pull\\/(\\d+)/);
  if (m) spec = m[1] + '/' + m[2] + '#' + m[3];
  if (spec.indexOf('#') === -1) { alert('use owner/repo#number ou a URL do PR'); return; }
  runBtn.disabled = true;
  tl.innerHTML = '';
  tl.classList.add('show');
  verdict.classList.remove('show');
  stageEls.clear();
  chunkBuffers.clear();

  try {
    var resp = await fetch('/api/demo/stream?pr=' + encodeURIComponent(spec));
    if (!resp.body) throw new Error('sem stream');
    var reader = resp.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    for (;;) {
      var result = await reader.read();
      if (result.done) break;
      buf += dec.decode(result.value, { stream: true });
      var events = buf.split('\\n\\n');
      buf = events.pop() || '';
      for (var i = 0; i < events.length; i++) {
        var line = events[i].trim();
        if (!line.startsWith('data:')) continue;
        try { handleEvent(JSON.parse(line.slice(5).trim())); } catch {}
      }
    }
  } catch (e) {
    ensureStage('fatal', 'Erro');
    updateStage('fatal', 'error', 'Erro', e.message);
  } finally {
    runBtn.disabled = false;
  }
}

function handleEvent(ev) {
  switch (ev.type) {
    case 'step':
      ensureStage(ev.id, ev.label);
      updateStage(ev.id, ev.status, ev.label, ev.detail);
      if (ev.status === 'done' || ev.status === 'error') freezeChunk(ev.id);
      break;
    case 'pr':
      addPayload('fetch', 'response', ev.title + '\\npor ' + ev.author + '\\n' + ev.files.length + ' arquivos');
      break;
    case 'model-try':
      appendTry(ev.stage, '[tentativa ' + ev.attempt + '/' + ev.total + '] ' + ev.model);
      break;
    case 'chunk':
      appendChunk(ev.stage, ev.text);
      break;
    case 'llm-request':
      addPayload(ev.stage, 'request', '→ ' + ev.model + '\\n\\n' + (ev.user || '').slice(0, 300) + ((ev.user || '').length > 300 ? '…' : ''));
      break;
    case 'llm-response': {
      var extra = '';
      if (ev.intent) extra += '\\n\\n→ classificação: ' + ev.intent.kind + ' (confiança ' + Math.round(ev.intent.confidence * 100) + '%)';
      if (ev.modelUsed) extra += '\\n→ modelo: ' + ev.modelUsed;
      if (ev.agrees !== undefined) extra += '\\n\\n→ ' + (ev.agrees ? 'concordou' : 'discordou') + (ev.counterKind ? ' — sugere: ' + ev.counterKind : '');
      addPayload(ev.stage, 'response', '← ' + ev.latencyMs + 'ms' + extra);
      break;
    }
    case 'result':
      renderVerdict(ev);
      break;
    case 'fatal':
      ensureStage('fatal', 'Erro');
      updateStage('fatal', 'error', 'Erro', ev.message);
      break;
    case 'done':
      updateStage('decide', 'done', 'Concluído', '');
      break;
  }
}

function renderVerdict(ev) {
  var kind = ev.final.kind;
  var action = ev.decision.action;
  var cls = action === 'approve' ? 'approve' : 'request_human';
  var cacheTag = ev.cached ? '<span class="tag">CACHE</span>' : '';
  verdict.className = 'verdict show ' + cls;
  verdict.innerHTML =
    '<h2>' + (action === 'approve' ? '🟢 Weft aprovaria automaticamente' : '🟡 Weft escalaria para humano') + cacheTag + '</h2>' +
    '<div class="row"><b>PR</b><span>' + escapeHtml(ev.pr) + ' — ' + escapeHtml(ev.title) + '</span></div>' +
    '<div class="row"><b>Autor</b><span>' + escapeHtml(ev.author) + '</span></div>' +
    '<div class="row"><b>Classificação</b><span><span class="badge ' + kind + '">' + kind + '</span></span></div>' +
    '<div class="row"><b>Confiança</b><span>' + Math.round(ev.final.confidence * 100) + '%</span></div>' +
    '<div class="row"><b>Latência total</b><span>' + ev.latencyMs + 'ms</span></div>' +
    '<div class="row"><b>Revisor</b><span>' + (ev.challenge.agrees ? 'concordou' : 'discordou') + (ev.challenge.model ? ' (' + ev.challenge.model + ')' : '') + '</span></div>' +
    '<div class="row"><b>Razão</b><span>' + escapeHtml(ev.decision.reason) + '</span></div>' +
    (ev.final.reasons.length ? '<ul class="reasons">' + ev.final.reasons.map(function(r) { return '<li>' + escapeHtml(r) + '</li>'; }).join('') + '</ul>' : '') +
    '<details><summary>JSON completo</summary><pre>' + escapeHtml(JSON.stringify(ev, null, 2)) + '</pre></details>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, function(c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]; });
}

runBtn.onclick = run;
prInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') run(); });
document.querySelectorAll('.ex a').forEach(function(a) {
  a.onclick = async function() {
    if (a.dataset.pr) { prInput.value = a.dataset.pr; run(); return; }
    if (a.dataset.repo) {
      var original = a.textContent;
      a.textContent = 'carregando…';
      var r = await fetch('/api/demo/list?repo=' + encodeURIComponent(a.dataset.repo));
      var j = await r.json();
      if (Array.isArray(j) && j.length) { prInput.value = j[0].spec; run(); }
      else alert('não consegui listar PRs');
      a.textContent = original;
    }
  };
});
</script>
</body>
</html>`;
