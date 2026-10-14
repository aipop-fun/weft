import { LANDING, DASHBOARD, DOCS } from "./templates";
import { HOME, pageOSS, pageFintech, pageMonorepo, pageCompliance, renderLanding } from "./landing";
import { renderSitemap, renderRobots } from "./seo";
import { DEMO_HTML, demoStreamRoute, demoListRoute } from "./demo";
import { renderPricing } from "./pages/pricing";
import { COMECANDO } from "./onboarding/page";
import { PRIVACY, TERMS, SECURITY } from "./legal/templates";
import { detectLocale, localeFromPath, type Locale } from "@weft/i18n";

const port = Number(process.env.WEB_PORT ?? 3001);
const serverPort = Number(process.env.PORT ?? 3000);
const serverURL = process.env.WEFT_URL ?? `http://localhost:${serverPort}`;

const html = (s: string, cache = "no-cache") =>
  new Response(s, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

Bun.serve({
  port,
  idleTimeout: 240,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // ---------- SEO ----------
    if (path === "/sitemap.xml") {
      return new Response(renderSitemap(), {
        headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    }
    if (path === "/robots.txt") {
      return new Response(renderRobots(), {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    }

    // ---------- detecta locale ----------
    const { locale: pathLocale, path: effectivePath } = localeFromPath(path);
    const locale: Locale = pathLocale ?? detectLocale(req, url);

    // ---------- pricing ----------
    if (effectivePath === "/precos" || effectivePath === "/pricing") {
      return html(renderPricing(locale), "public, max-age=300");
    }

    // ---------- legal ----------
    if (path === "/privacidade") return html(PRIVACY, "public, max-age=3600");
    if (path === "/termos") return html(TERMS, "public, max-age=3600");
    if (path === "/seguranca") return html(SECURITY, "public, max-age=3600");
    if (path === "/.well-known/security.txt") {
      try {
        const txt = await Bun.file("apps/web/public/.well-known/security.txt").text();
        return new Response(txt, { headers: { "content-type": "text/plain" } });
      } catch {
        return new Response("Contact: mailto:security@weft.dev\n", { headers: { "content-type": "text/plain" } });
      }
    }

    // ---------- onboarding ----------
    if (path === "/comecando" || path === "/getting-started") {
      return html(COMECANDO, "public, max-age=600");
    }

    // ---------- landing ----------
    if (effectivePath === "/") return html(renderLanding(HOME), "public, max-age=300");
    if (effectivePath === "/para/oss") return html(renderLanding(pageOSS()), "public, max-age=300");
    if (effectivePath === "/para/fintech") return html(renderLanding(pageFintech()), "public, max-age=300");
    if (effectivePath === "/para/monorepo") return html(renderLanding(pageMonorepo()), "public, max-age=300");
    if (effectivePath === "/para/compliance") return html(renderLanding(pageCompliance()), "public, max-age=300");

    // ---------- app ----------
    if (path === "/dashboard") return html(DASHBOARD);
    if (path === "/docs") return html(DOCS);
    if (path === "/demo") return html(DEMO_HTML);
    if (path === "/api/demo/stream") return demoStreamRoute(req);
    if (path === "/api/demo/list") return demoListRoute(req);

    // ---------- proxy para o server ----------
    if (path.startsWith("/api/")) {
      try {
        const target = `${serverURL}${path}${url.search}`;
        const init: RequestInit = { method: req.method, headers: req.headers };
        if (!["GET", "HEAD"].includes(req.method)) init.body = await req.text();
        const r = await fetch(target, init);
        const buf = await r.arrayBuffer();
        return new Response(buf, {
          status: r.status,
          headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
        });
      } catch (e) {
        return new Response(
          JSON.stringify({ error: "server offline", detail: (e as Error).message }),
          { status: 502, headers: { "content-type": "application/json" } },
        );
      }
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`weft-web :${port}`);
console.log(`  /            landing`);
console.log(`  /precos      preços (pt-BR / en)`);
console.log(`  /en/precos   pricing (EN)`);
console.log(`  /demo        demo`);
console.log(`  /comecando   onboarding`);
console.log(`  /sitemap.xml /robots.txt`);
console.log(`  → proxy /api/* → ${serverURL}`);
