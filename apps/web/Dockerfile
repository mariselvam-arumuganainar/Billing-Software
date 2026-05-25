FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Accept public env vars at build time (Next.js bakes them in at build)
ARG NEXT_PUBLIC_API_GATEWAY_URL
ARG NEXT_PUBLIC_BILLING_ENGINE_URL
ENV NEXT_PUBLIC_API_GATEWAY_URL=$NEXT_PUBLIC_API_GATEWAY_URL
ENV NEXT_PUBLIC_BILLING_ENGINE_URL=$NEXT_PUBLIC_BILLING_ENGINE_URL

RUN npm run build

# ── Minimal runtime image ──────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "run", "start"]
