# One image, one process, one port (decision 7): the same Node process answers
# `/api/*` and serves the built client, so the home lab needs one container and
# one ingress. The only stateful thing is `DATA_DIR`, which is a volume
# (decision 6).
#
# Two stages. The build stage has pnpm, the whole workspace and a C++ toolchain
# — better-sqlite3 is a native module and falls back to compiling when no
# prebuilt binary matches the platform. The runtime stage has none of that: it
# gets `pnpm deploy`'s production-only tree, so the toolchain, the dev
# dependencies and the TypeScript sources never reach the shipped image.

# syntax=docker/dockerfile:1

FROM node:22-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# pnpm 9, pinned by the root package.json `packageManager` field.
RUN corepack enable

# Only needed if better-sqlite3 has no prebuilt binary for this platform; the
# whole stage is discarded either way.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Manifests first, so a source-only change does not re-resolve dependencies.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/sudoku-core/package.json packages/sudoku-core/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY . .
# esbuild bundles the server (sudoku-core with it); vite bundles the client into
# dist/client, which @fastify/static serves.
RUN pnpm --filter web build

# A self-contained production tree: the three esbuild externals
# (better-sqlite3, fastify, @fastify/static) with their native builds, and
# nothing that only the build needed.
RUN pnpm deploy --filter=web --prod /deploy


FROM node:22-slim AS runtime

ENV NODE_ENV=production
# Decision 6: the SQLite file lives here and this is the only mount.
ENV DATA_DIR=/data
ENV PORT=8080
ENV HOST=0.0.0.0

WORKDIR /app
# Only the two things the runtime needs from the deploy tree: the resolved
# production dependencies, and the manifest — `"type": "module"` lives there and
# without it Node reads the ESM bundle as CommonJS. Deliberately NOT the whole
# `/deploy`: `pnpm deploy` packs the package's sources too, and TypeScript,
# specs and a vite config have no business in a runtime image.
COPY --from=build /deploy/node_modules /app/node_modules
COPY --from=build /deploy/package.json /app/package.json
# The build output, copied straight from the build stage rather than taken from
# the deploy pack — `dist/` is gitignored, and npm's packing rules honour that,
# so this is what stops the image silently shipping without a client or without
# its migrations.
COPY --from=build /src/apps/web/dist /app/dist

RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME /data
EXPOSE 8080

# Cheap and honest: it exercises the route the client's first request uses.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/history').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
