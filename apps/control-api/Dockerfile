FROM node:20-alpine AS base
RUN corepack enable

FROM base AS builder
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/control-api ./apps/control-api
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @me/control-api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/apps/control-api/dist ./dist
COPY --from=builder /repo/apps/control-api/package.json ./package.json
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
EXPOSE 8080
CMD ["node", "dist/server.js"]
