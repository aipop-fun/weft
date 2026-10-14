// Logs em JSON, uma linha por evento. Compatível com Fly.io, Datadog, Loki.

export type Level = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: Level;
  msg: string;
  at: string;
  [k: string]: unknown;
}

const SENTRY_DSN = process.env.SENTRY_DSN ?? "";
const SENTRY_ENDPOINT = SENTRY_DSN ? parseSentryDsn(SENTRY_DSN) : "";

function parseSentryDsn(dsn: string): string {
  try {
    const url = new URL(dsn);
    const key = url.username;
    const projectId = url.pathname.replace("/", "");
    return `${url.protocol}//${url.host}/api/${projectId}/store/?sentry_key=${key}&sentry_version=7`;
  } catch { return ""; }
}

async function sendSentry(entry: LogEntry): Promise<void> {
  if (!SENTRY_ENDPOINT) return;
  try {
    await fetch(SENTRY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timestamp: entry.at,
        level: entry.level,
        message: entry.msg,
        tags: { service: "weft" },
        extra: entry,
      }),
    });
  } catch {}
}

function emit(level: Level, msg: string, extra: Record<string, unknown> = {}): void {
  const entry: LogEntry = { level, msg, at: new Date().toISOString(), ...extra };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  if (level === "error") void sendSentry(entry);
}

export const log = {
  debug: (msg: string, extra?: Record<string, unknown>) => emit("debug", msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => emit("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => emit("error", msg, extra),
  child: (base: Record<string, unknown>) => ({
    debug: (msg: string, extra?: Record<string, unknown>) => emit("debug", msg, { ...base, ...extra }),
    info: (msg: string, extra?: Record<string, unknown>) => emit("info", msg, { ...base, ...extra }),
    warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", msg, { ...base, ...extra }),
    error: (msg: string, extra?: Record<string, unknown>) => emit("error", msg, { ...base, ...extra }),
  }),
};
