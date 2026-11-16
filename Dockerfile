# tresjr-frontends — every screen, self-hosted (SELF_HOSTING.md): the built
# screens (dist/) and the small server that adds their security policy
# (worker/node.ts, the same app as the Cloudflare Worker).
# The bundle is plain JavaScript: built once, on the build machine's own
# platform; only the image below is per architecture (amd64, arm64).
FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm run build:node

# The image that runs: distroless — Node 24 on Debian, nothing else (no
# shell, no package manager: less to patch). Node is its entrypoint. As uid
# 1000, like the Alpine image before (the installer runs it so; existing data
# volumes belong to it).
FROM gcr.io/distroless/nodejs24-debian13@sha256:24bc0fe0225c7518f202a822587dad74fe143b96326b81fe5cc08c1df8bed03e
LABEL org.opencontainers.image.source="https://github.com/arcanum-pos/arcanum-frontends" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.description="tresjr frontends — every screen"
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DIST=/app/dist
COPY --from=build /src/dist ./dist
COPY --from=build /src/dist-node/server.mjs ./dist-node/server.mjs
USER 1000:1000
EXPOSE 8080
CMD ["dist-node/server.mjs"]
