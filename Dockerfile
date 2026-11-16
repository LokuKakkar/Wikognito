# Wikognito production images (multi-arch: builds on amd64 and arm64).
#
#   docker build --target backend  -t wikognito-backend .
#   docker build --target frontend -t wikognito-frontend \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://example.org .
#
# Both targets contain the full workspace: the backend runs through tsx (workspace
# packages export .ts) and the operator CLIs (articles:restore, dossiers:seed, ...)
# are run from the backend image. Dev dependencies are required, so no `--prod`.

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@10.32.1
ENV CI=true
WORKDIR /app
RUN chown node:node /app
USER node

FROM base AS deps
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/backend/package.json apps/backend/package.json
COPY --chown=node:node apps/frontend/package.json apps/frontend/package.json
COPY --chown=node:node packages/shared/package.json packages/shared/package.json
COPY --chown=node:node packages/puzzle-engine/package.json packages/puzzle-engine/package.json
COPY --chown=node:node packages/test-utils/package.json packages/test-utils/package.json
COPY --chown=node:node services/article-provider/package.json services/article-provider/package.json
COPY --chown=node:node services/article-ingestion/package.json services/article-ingestion/package.json
# The backend postinstall runs `prisma generate`, which needs the schema.
COPY --chown=node:node apps/backend/prisma apps/backend/prisma
RUN pnpm install --frozen-lockfile

FROM deps AS source
COPY --chown=node:node . .

FROM source AS backend
ENV NODE_ENV=production
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.BACKEND_PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["pnpm", "--filter", "@redactle/backend", "start"]

FROM source AS frontend
# Inlined into the client bundle and the CSP at build time; changing it needs a rebuild.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_ILLUSTRATIONS_PACK=none
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_ILLUSTRATIONS_PACK=$NEXT_PUBLIC_ILLUSTRATIONS_PACK \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @redactle/frontend... build
ENV NODE_ENV=production
EXPOSE 3002
CMD ["pnpm", "--filter", "@redactle/frontend", "start"]
