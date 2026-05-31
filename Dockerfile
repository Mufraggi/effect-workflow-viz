# syntax=docker/dockerfile:1

# The web app runs its TypeScript directly via tsx (no build step), so the
# runtime image just needs Node, the installed dependencies, and the source.
# The final stage is distroless: no shell, no package manager, runs as nonroot.

# ---- builder: install deps (incl. native better-sqlite3) on a full Node image ----
FROM node:24.5.0-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
# Build toolchain for the one native module (better-sqlite3, via @effect/sql-sqlite-node).
# It is compiled here against Node 24 / debian12-glibc, matching the distroless
# runtime below, so the prebuilt binary is ABI-compatible.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy only the manifests first so the install layer is reused across source changes.
COPY pnpm-lock.yaml package.json ./
COPY packages/api/package.json       packages/api/package.json
COPY packages/auth/package.json      packages/auth/package.json
COPY packages/database/package.json  packages/database/package.json
COPY packages/domain/package.json    packages/domain/package.json
COPY packages/web/package.json       packages/web/package.json
# Trim the workspace config for the image build: keep the package globs and the
# native-build allowlist, but drop `supportedArchitectures` — the committed
# version pulls native bindings (esbuild, lightningcss, …) for every dev OS,
# arch, and libc, which is ~200 MB of binaries this single-platform image never
# runs. Without it, pnpm installs only the bindings for the platform being built
# (auto-matching amd64/arm64). Neither setting affects lockfile resolution, so
# `--frozen-lockfile` still holds.
RUN printf 'packages:\n  - packages/*\nonlyBuiltDependencies:\n  - better-sqlite3\n' > pnpm-workspace.yaml
# `--prod` drops devDependencies (typescript, eslint, vitest, babel, the Effect
# language service, …) that the running app never imports. tsx is a runtime dep
# of @template/web, so it survives the prune.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Source tree (node_modules excluded via .dockerignore — keep pnpm's install).
COPY . .

# Writable location for the auth SQLite DB, owned by the distroless nonroot uid.
# Mount a volume here to persist the first-run admin account across restarts.
RUN mkdir -p /app/data && chown -R 65532:65532 /app/data

# ---- runtime: distroless (no shell / no package manager, runs as nonroot 65532) ----
# Node 24 to match the builder so the native better-sqlite3 binding loads.
FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV AUTH_DB_PATH=/app/data/auth.db

# The whole app: root + per-package node_modules trees (pnpm creates a
# node_modules in each workspace package, symlinked into the root .pnpm store)
# plus the source. Chowned so nonroot can read it and write /app/data.
COPY --from=builder --chown=65532:65532 /app /app

EXPOSE 3000
VOLUME ["/app/data"]

# tsx resolves the workspace's tsconfig `paths`, so the process must run from the
# web package directory (which is also where the asset server resolves
# ../../node_modules relative to its cwd).
WORKDIR /app/packages/web

# The distroless nodejs image's ENTRYPOINT is ["/nodejs/bin/node"]; CMD supplies
# its args. `--import tsx` registers the TypeScript loader before running the server.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["--import", "tsx", "server.ts"]
