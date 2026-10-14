import { ptBR } from "./strings/pt-BR";
import { en } from "./strings/en";

export type Locale = "pt-BR" | "en";

const DICTS: Record<Locale, Record<string, string>> = {
  "pt-BR": ptBR as any,
  en: en as any,
};

export const SUPPORTED: Locale[] = ["pt-BR", "en"];
export const DEFAULT: Locale = "pt-BR";

export function detectLocale(req: Request, url: URL): Locale {
  // 1. query param ?lang=en
  const q = url.searchParams.get("lang");
  if (q && SUPPORTED.includes(q as Locale)) return q as Locale;

  // 2. cookie
  const cookie = req.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === "weft_lang" && v && SUPPORTED.includes(v as Locale)) return v as Locale;
  }

  // 3. Accept-Language
  const al = req.headers.get("accept-language") ?? "";
  if (/\ben\b|en-US|en-GB/i.test(al) && !/\bpt\b|pt-BR|pt-PT/i.test(al.split(",")[0] ?? "")) {
    return "en";
  }

  return DEFAULT;
}

export function t(locale: Locale, key: string): string {
  return DICTS[locale]?.[key] ?? DICTS[DEFAULT][key] ?? key;
}

export function translator(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) => {
    let s = t(locale, key);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replaceAll(`{${k}}`, String(v));
      }
    }
    return s;
  };
}

export function localeFromPath(path: string): { locale?: Locale; path: string } {
  // suporta /en/* e /pt/* como prefixo opcional
  const m = path.match(/^\/(en|pt)(\/.*)?$/);
  if (!m) return { path };
  const locale: Locale = m[1] === "en" ? "en" : "pt-BR";
  return { locale, path: m[2] || "/" };
}
