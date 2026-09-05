# syntax=docker/dockerfile:1

# Node base plus Python + ddddocr for Bigshare CAPTCHA solving
# (Debian slim so ddddocr ships binary wheels; Alpine/musl would need a source build).
FROM node:20-slim AS base
WORKDIR /app

# Python kept for ops tooling only (OCR now runs via the OCR.Space HTTPS API).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages ddddocr==5.4.6 pillow==11.3.0

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --home-dir /home/nextjs --create-home nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# Generated Prisma client (custom output at src/generated/prisma) plus the
# CLI packages needed to run `prisma migrate deploy` at container start.
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv

USER nextjs

EXPOSE 3000

# Apply pending migrations when DATABASE_URL is set (skipped otherwise —
# the app also runs with an in-memory fallback), then serve.
CMD ["sh", "-c", "node scripts/migrate-if-db.mjs && exec node server.js"]