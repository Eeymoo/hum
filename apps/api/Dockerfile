FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json ./
RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 指定生成 musl 兼容的 Prisma 引擎
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# 安装 openssl 并设置 Prisma 引擎目标
RUN apk add --no-cache openssl
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
ENV LD_LIBRARY_PATH=/usr/lib
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma/migrations_sqlite ./prisma/migrations_sqlite
COPY --from=builder --chown=nextjs:nodejs /app/prisma/migrations_postgresql ./prisma/migrations_postgresql
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
RUN mkdir -p public uploads prisma/migrations && chown -R nextjs:nodejs public uploads prisma

# 创建启动脚本（在切换用户前创建，确保权限正确）
RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -e' \
    '' \
    'echo "🔄 Running database migration..."' \
    'node scripts/prisma-switch.js' \
    'npx prisma migrate deploy' \
    '' \
    'echo "🚀 Starting application..."' \
    'exec node server.js' \
    > /app/start.sh && chmod +x /app/start.sh && chown nextjs:nodejs /app/start.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["/app/start.sh"]
