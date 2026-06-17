# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install all deps (including devDependencies needed for nest build / tsc)
COPY package*.json ./
RUN npm ci --prefer-offline

# Build the NestJS app
COPY . .
RUN npm run build

# ── Stage 2: run ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Only production dependencies in the final image
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline

# Non-root user for security. Use numeric IDs so Kubernetes can verify runAsNonRoot.
RUN addgroup -S -g 10001 appgroup && adduser -S -D -H -u 10001 -G appgroup appuser

# Copy compiled output from builder
COPY --from=builder --chown=10001:10001 /app/dist ./dist
COPY --chown=10001:10001 docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER 10001:10001

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
