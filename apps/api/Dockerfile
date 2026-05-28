FROM node:20-alpine AS base

# --- 安装依赖（利用 Docker 层缓存） ---
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# 先复制 package.json 和 lockfile，依赖不变时这一层可以命中缓存
COPY package.json package-lock.json ./
RUN npm install --ignore-scripts

# --- 构建 ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN npx prisma generate
RUN npm run build

# --- 生产镜像 ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
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
# 复制完整的 prisma CLI 包（不能只复制 .bin/prisma，因为那是符号链接，
# COPY 跟随符号链接会导致 __dirname 错误，找不到 WASM 文件）
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
RUN mkdir -p node_modules/.bin && ln -s ../prisma/build/index.js node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
RUN mkdir -p public uploads prisma/migrations && chown -R nextjs:nodejs public uploads prisma

# 创建启动脚本
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
