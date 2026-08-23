# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS build
WORKDIR /app

ENV HUSKY=0

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY mcp-server/package.json ./mcp-server/package.json
RUN pnpm install --frozen-lockfile --filter @english-punch/mcp-server

COPY convex ./convex
COPY mcp-server ./mcp-server
RUN pnpm --filter @english-punch/mcp-server build

FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/mcp-server/node_modules ./mcp-server/node_modules
COPY --from=build /app/mcp-server/dist ./mcp-server/dist
COPY --from=build /app/mcp-server/package.json ./mcp-server/package.json

USER node
EXPOSE 3001

CMD ["node", "mcp-server/dist/http-index.js"]
