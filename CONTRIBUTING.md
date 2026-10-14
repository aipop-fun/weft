# Contribuindo

Antes de abrir um PR grande, abra uma issue descrevendo o problema.

## Setup

```bash
git clone https://github.com/aipop-fun/weft
cd weft
bun install
cp .env.example .env
./dev.sh

### Estrutura
```text
apps/server     API + webhooks do GitHub
apps/web        Landing + demo + dashboard
packages/db     SQLite + schema
packages/github GitHub App + HMAC + client
packages/llm    Anthropic + OpenRouter
packages/intent Classificação + adversarial
packages/rules  Regra dura + decisão
packages/review Orquestrador
packages/middleware Auth, CSRF, CORS, rate limit
```

### O que aceitamos
Correções de bugs com reprodução

Novos templates de regras verticais

### Traduções

Melhorias de performance comprovadas

O que recusamos
Features genéricas sem caso concreto

Dependências pesadas sem justificativa

Qualquer coisa que enfraqueça a regra dura por path

Código que quebre isolamento multi-tenant

Commits
Conventional Commits: feat, fix, docs, refactor, test, chore.
