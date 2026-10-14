# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Classificação de PRs via LLM com fallback entre modelos gratuitos
- Revisor adversarial com modelo diferente do classificador
- Regra dura por path (`auth/`, `security/`, `billing/`, `migrations/`)
- Modo observação de 7 dias por padrão
- Cache por PR (head_sha) com TTL de 30 min
- Rate limit de 5 PRs/min por IP no `/demo`
- Multi-tenant com isolamento por `org_id`
- CSRF token em todas as mutações
- CORS com whitelist via `CORS_ORIGINS`
- Rotação de sessão a cada 24h
- Audit log com export CSV/JSON
- Feedback estruturado (base do dataset de treino)
- Templates verticais: SOC2, HIPAA, PCI
- Landing com SEO, JSON-LD, sitemap, robots
- i18n pt-BR / en
- Páginas legais (privacidade, termos, segurança)
- Deploy Docker + Helm
- Observability com logs JSON e uptime check

[Unreleased]: https://github.com/aipop-fun/weft/commits/main
