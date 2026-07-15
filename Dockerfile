# syntax=docker/dockerfile:1
#
# Multi-stage build for the Next.js app. A build stage with the full toolchain
# installs deps and runs `pnpm build`, then a slim runtime stage ships only the
# standalone output (`.next/standalone` + `.next/static` + `public/`) and runs
# `node server.js` as a non-root user - no pnpm, no dev dependencies, and no
# ambient root in the final image. See docs/ops/deployment.md ("Target: Docker").
#
# Requires `output: "standalone"` in next.config.js so the build traces the
# runtime deps into `.next/standalone`. Pin both base images to a digest
# (name@sha256:...) once you settle on versions - a digest beats a floating tag
# for reproducible, rollback-safe builds.

# --- Build stage -------------------------------------------------------------
# Match the Node version to .tool-versions / .nvmrc. corepack activates the
# pnpm pinned in package.json's "packageManager" field.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

# Install deps first so this layer caches across source-only edits.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Then the sources, and build the standalone output. NEXT_PUBLIC_* values are
# inlined into the client bundle at build time, so pass them here as build args
# if they differ per environment (never pass a server-only secret this way).
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- Runtime stage -----------------------------------------------------------
# A slim runtime with just the traced standalone server - no pnpm, no toolchain.
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create an unprivileged user and never run as root.
RUN useradd --create-home --uid 10001 app

# Copy only what the standalone server needs. `.next/standalone` carries a
# minimal node_modules and the server entrypoint; static assets and public/ are
# served alongside it.
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

# Configuration comes from the environment at run time - never COPY a .env or a
# secret into an image layer (.dockerignore keeps .env* out of the build context).
USER app
EXPOSE 3000
CMD ["node", "server.js"]
