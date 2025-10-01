# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install
RUN pnpm --filter @pwyf/client build

FROM nginx:1.25-alpine
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
