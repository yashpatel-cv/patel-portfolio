# syntax=docker/dockerfile:1
# ============================================================
# Multi-stage build — Oracle ARM (aarch64 / Ampere A1) safe.
# Every image referenced is published multi-arch (arm64 + amd64);
# the build pulls pure-JS dependencies only, so no x86-native
# binaries can creep into the final artifact.
#
#   Stage 1 (deps)  : node:22-alpine  — deterministic npm ci
#   Stage 2 (build) : node:22-alpine  — astro static build
#   Stage 3 (run)   : nginxinc/nginx-unprivileged:1.27-alpine
#                     — non-root, listens on 8080 by design
# ============================================================

# ---------- Stage 1: dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Layer-cache dependencies independently of source changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- Stage 2: build ----------
FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production \
    ASTRO_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Type-check the content seam + components, then emit static HTML/CSS/JS.
RUN npm run check && npm run build

# ---------- Stage 3: runtime ----------
# Unprivileged nginx: runs as UID 101, pid/cache under /tmp,
# binds the non-privileged port 8080 — no root anywhere.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.inc /etc/nginx/conf.d/security-headers.inc
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
