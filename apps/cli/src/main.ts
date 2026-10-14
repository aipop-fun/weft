#!/usr/bin/env bun
import { parseArgs } from "node:util";

const HELP = `weft — CLI

USO
  weft <comando> [flags]

COMANDOS
  stats                     Estatísticas do servidor
  rules list --repo <r>     Lista regras de um repo
  rules add --repo <r> --prefix <p> --human <n>
  review <owner/repo#N>     Roda o review (via /demo)
  version

EXEMPLOS
  weft stats
  weft rules add --repo acme/monorepo --prefix auth/ --human 2
  weft review anthropics/anthropic-sdk-python#500
`;

const args = process.argv.slice(2);
if (!args.length || args[0] === "--help" || args[0] === "-h") {
  console.log(HELP);
  process.exit(0);
}

const cmd = args[0];
let parsed: { values: Record<string, string | undefined> };
try {
  parsed = parseArgs({
    args: args.slice(1),
    options: {
      repo: { type: "string" },
      prefix: { type: "string" },
      human: { type: "string" },
      base: { type: "string", default: process.env.WEFT_URL ?? "http://localhost:3000" },
      web: { type: "string", default: process.env.WEFT_WEB ?? "http://localhost:3001" },
    },
    allowPositionals: true,
  });
} catch {
  console.log(HELP);
  process.exit(1);
}

const base = parsed.values.base as string;
const web = parsed.values.web as string;

switch (cmd) {
  case "version":
    console.log("weft 0.1.0");
    break;

  case "stats": {
    try {
      const r = await fetch(`${base}/api/stats`);
      const s = (await r.json()) as Record<string, number>;
      const total = Number(s.total) || 0;
      const rate = total ? Math.round((Number(s.approved) / total) * 100) : 0;
      console.log(`PRs analisados:   ${total}`);
      console.log(`Auto-aprovados:   ${s.approved ?? 0}`);
      console.log(`Escalados:        ${s.escalated ?? 0}`);
      console.log(`Em observação:    ${s.observed ?? 0}`);
      console.log(`Automação:        ${rate}%`);
      console.log(`Latência média:   ${Math.round(s.avg_latency ?? 0)}ms`);
    } catch (e) {
      console.error("servidor offline?", (e as Error).message);
      process.exit(1);
    }
    break;
  }

  case "rules": {
    const sub = args[1];
    if (sub === "list") {
      if (!parsed.values.repo) { console.error("--repo é obrigatório"); process.exit(1); }
      const r = await fetch(`${base}/api/rules?repo=${encodeURIComponent(parsed.values.repo)}`);
      console.log(JSON.stringify(await r.json(), null, 2));
    } else if (sub === "add") {
      if (!parsed.values.repo || !parsed.values.prefix) {
        console.error("--repo e --prefix são obrigatórios");
        process.exit(1);
      }
      const r = await fetch(`${base}/api/rules`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repo: parsed.values.repo,
          path_prefix: parsed.values.prefix,
          required_human: Number(parsed.values.human ?? 1),
          block_auto: true,
        }),
      });
      console.log(JSON.stringify(await r.json(), null, 2));
    } else {
      console.log(HELP);
      process.exit(1);
    }
    break;
  }

  case "review": {
    const spec = args[1];
    if (!spec) { console.error("uso: weft review owner/repo#N"); process.exit(1); }
    const r = await fetch(`${web}/api/demo?pr=${encodeURIComponent(spec)}`);
    const d = await r.json();
    console.log(JSON.stringify(d, null, 2));
    break;
  }

  default:
    console.log(HELP);
    process.exit(1);
}
