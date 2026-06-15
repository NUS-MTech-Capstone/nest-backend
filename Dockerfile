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

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy compiled output from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]
