# syntax=docker/dockerfile:1
# Multi-stage build cho Next.js ở chế độ `output: 'standalone'` (next.config.ts).
# Kết quả: image chỉ chứa server bundle + static, chạy bằng user không đặc quyền.

# ---------- Stage deps ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Cài đúng theo lock file để build tái lập được.
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Stage build ----------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Biến NEXT_PUBLIC_* được inline vào bundle LÚC BUILD, nên phải truyền ở đây.
ARG NEXT_PUBLIC_APP_NAME="Document Hub"
ARG NEXT_PUBLIC_APP_ENV=production
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN npm run build

# ---------- Stage runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# node:22-alpine đã có sẵn user "node" (uid 1000).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# public/ có thể không tồn tại — dùng ký tự đại diện để không vỡ build.
COPY --from=builder --chown=node:node /app/publi[c] ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
