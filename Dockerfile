# syntax=docker/dockerfile:1

# Multi-stage build producing a minimal standalone Next.js server.
# Mirrors the pattern already used by the mobix-landing app on the same host.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm install`, not `npm ci`: the lockfile is generated on macOS and cannot
# record sharp's Linux-only optional binaries (@emnapi/*), which makes `npm ci`
# fail the in-sync check on this platform. Regenerate the lockfile on Linux if
# reproducible installs become a requirement.
RUN npm install --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# basePath must be baked in at build time: Next inlines it into client bundles,
# asset URLs and the router, so it cannot be changed at container start.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

# Placeholder satisfying the env schema at build time; the real value is injected
# at runtime via docker-compose. Never bake a real secret into an image layer.
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime"

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
