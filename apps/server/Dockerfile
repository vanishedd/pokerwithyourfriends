# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install
RUN pnpm --filter @pwyf/shared build || true
RUN pnpm --filter @pwyf/server build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared ./packages/shared
ENV NODE_ENV=production
ENV PORT=4000
CMD ["node", "apps/server/dist/index.js"]
