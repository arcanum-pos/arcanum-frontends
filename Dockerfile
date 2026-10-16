# tresjr-frontends — every screen, self-hosted (SELF_HOSTING.md): the built
# screens (dist/) and the small server that adds their security policy
# (worker/node.ts, the same app as the Cloudflare Worker).
# The bundle is plain JavaScript: built once, on the build machine's own
# platform; only the image below is per architecture (amd64, arm64).
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm run build:node

FROM node:24-alpine
LABEL org.opencontainers.image.source="https://github.com/arcanum-pos/arcanum-frontends" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.description="tresjr frontends — every screen"
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DIST=/app/dist
COPY --from=build /src/dist ./dist
COPY --from=build /src/dist-node/server.mjs ./dist-node/server.mjs
USER node
EXPOSE 8080
CMD ["node", "dist-node/server.mjs"]
