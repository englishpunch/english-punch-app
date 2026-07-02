# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS deps
WORKDIR /app

ENV HUSKY=0

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app

ARG VITE_CONVEX_URL=https://ep-convex.echoja.com
ARG VITE_CONVEX_SITE_URL=https://ep-convex-site.echoja.com

ENV VITE_CONVEX_URL=${VITE_CONVEX_URL}
ENV VITE_CONVEX_SITE_URL=${VITE_CONVEX_SITE_URL}

COPY . .
RUN pnpm run build

FROM caddy:2-alpine AS runtime

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80
