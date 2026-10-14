// Metadados, JSON-LD, sitemap e robots. Centraliza SEO.
export interface PageMeta {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string;
  type?: "website" | "article";
}

const SITE_URL = process.env.SITE_URL ?? "https://weft.dev";
const SITE_NAME = "Weft";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

export function renderHead(meta: PageMeta): string {
  const url = `${SITE_URL}${meta.path}`;
  const image = meta.image ?? DEFAULT_IMAGE;
  const keywords = meta.keywords?.join(", ") ?? "";
  return `
<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}">
${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}">` : ""}
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0a0a0b">

<!-- Open Graph -->
<meta property="og:type" content="${meta.type ?? "website"}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escapeHtml(meta.title)}">
<meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pt_BR">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(meta.title)}">
<meta name="twitter:description" content="${escapeHtml(meta.description)}">
<meta name="twitter:image" content="${image}">
<meta name="twitter:site" content="@weftdev">

<!-- Favicons -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<!-- Preconnect -->
<link rel="preconnect" href="https://api.github.com">
<link rel="preconnect" href="https://openrouter.ai">
`;
}

export function renderJsonLd(meta: PageMeta): string {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: ["https://github.com/weftdev/weft"],
  };
  const app = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web, Linux, macOS",
    description: meta.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Plano gratuito para repositórios públicos",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "127",
    },
  };
  return `
<script type="application/ld+json">${JSON.stringify(org)}</script>
<script type="application/ld+json">${JSON.stringify(app)}</script>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export const SITE = SITE_URL;

export const SITEMAP_PATHS = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/demo", priority: 0.9, changefreq: "weekly" },
  { path: "/docs", priority: 0.8, changefreq: "weekly" },
  { path: "/precos", priority: 0.8, changefreq: "monthly" },
  { path: "/para/oss", priority: 0.7, changefreq: "monthly" },
  { path: "/para/fintech", priority: 0.7, changefreq: "monthly" },
  { path: "/para/monorepo", priority: 0.7, changefreq: "monthly" },
  { path: "/para/compliance", priority: 0.7, changefreq: "monthly" },
];

export function renderSitemap(): string {
  const now = new Date().toISOString().split("T")[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_PATHS.map((p) => `  <url>
    <loc>${SITE_URL}${p.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n")}
</urlset>`;
}

export function renderRobots(): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard

Sitemap: ${SITE_URL}/sitemap.xml
`;
}
