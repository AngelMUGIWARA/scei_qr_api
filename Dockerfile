# ============================================================
# scei_qr_api - imagen de producción (multi-stage)
# Uso: docker build -t scei-qr-api . && docker run -p 3000:3000 --env-file .env scei-qr-api
# ============================================================

# --- Etapa 1: dependencias y build ---
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Dependencias de compilación (bcrypt trae binario precompilado; prisma engines)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# --- Etapa 2: producción (solo runtime) ---
FROM node:22-bookworm-slim AS production

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

# Carpeta de fotos (volume recomendado: -v fotos:/app/uploads)
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 3000

# Arranque: aplica migraciones pendientes y levanta la API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
