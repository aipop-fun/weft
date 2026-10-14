# Weft

**Reduza 80% do tempo de review de PR sem perder controle.**

Weft classifica cada pull request por risco, aprova automaticamente as
mudanças triviais, e escala as sensíveis para revisão humana — com
auditoria completa e regra dura por diretório.

## Como funciona

1. **Lê** cada PR via webhook do GitHub.
2. **Classifica** com LLM — trivial, sensitive ou unknown.
3. **Revisor adversarial** tenta refutar. Se discorda, escala.
4. **Regra dura**: auth/, security/, billing/ sempre humanos.
5. **Decide** — aprova, escala, ou só comenta (modo observação).
6. **Registra** cada decisão com autor, motivo, modelo, timestamp.

## Demo

Teste com qualquer PR público sem instalar:

https://weft.dev/demo

text

## Instalação

```bash
git clone https://github.com/aipop-fun/weft
cd weft
bun install
cp .env.example .env
# edite OPENROUTER_API_KEY
./dev.sh
Abre em http://localhost:3001

Modo observação
Por padrão, o Weft só comenta nos primeiros 7 dias. Não aprova nem
escala. Você vê o que ele teria feito antes de deixá-lo decidir.

Modelos
Suporta Anthropic e OpenRouter. Para dev gratuito:

env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=auto-free
Status
Protótipo funcional. Use em produção com cautela.

Licença
MIT.

## Após instalar

Para ver o dashboard com dados de exemplo:

```bash
./seed-demo.sh
Insere 3 PRs fictícios no banco local. Não afeta repositórios reais.
