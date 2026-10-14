FROM oven/bun:1.3.2-alpine AS base
WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/*/package.json packages/*/
COPY apps/*/package.json apps/*/
RUN bun install --production

COPY . .

RUN addgroup -S weft && adduser -S weft -G weft && chown -R weft:weft /app
USER weft

EXPOSE 3000 3001

CMD ["sh", "-c", "bun apps/server/src/main.ts & bun apps/web/src/main.ts & wait"]
