# scei_qr_api

Backend del sistema de **control de equipos por QR** (`scei_qr`). API REST en **NestJS 11 + Prisma + PostgreSQL (Neon)** que implementa las 32 historias de usuario del `arquitectura-backend.md`.

- **Prefijo global:** `/api/v1`
- **Documentación:** Swagger en `/api/docs`
- **Auth:** JWT (8 h) + bcrypt; roles `ADMIN`, `SOPORTE`, `ALUMNO`
- **Notas de versión:** Nest 11 (Nest 12 es ESM-only y rompe Jest/CommonJS)

## Requisitos

- Node.js ≥ 20 (probado con 22 / 26)
- Cuenta en [Neon](https://neon.tech) (plan Free compartido por el equipo)

## Arranque rápido (onboarding de los 5 devs)

```bash
# 1. Copiar la plantilla de variables
cp .env.example .env

# 2. Pedir al que administra Neon la connection string (pooled y direct)
#    y completar DATABASE_URL y DIRECT_URL en .env (ver "Base de datos" abajo)

# 3. Generar un JWT_SECRET propio
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Instalar dependencias y generar el cliente Prisma
npm install
npx prisma generate

# 5. Migraciones + datos demo
npx prisma migrate deploy     # en tu branch local de BD usa `migrate dev`
npm run prisma:seed

# 6. Levantar
npm run start:dev
```

API en `http://localhost:3000/api/v1` · Swagger en `http://localhost:3000/api/docs`

### Credenciales demo (seed)

| Usuario    | Contraseña    | Rol      |
| ---------- | ------------- | -------- |
| `admin`    | `Password123!`| ADMIN    |
| `soporte`  | `Password123!`| SOPORTE  |
| `alumno1`  | `Password123!`| ALUMNO   |
| `alumno2`  | `Password123!`| ALUMNO   |

## Base de datos (Neon)

Cada desarrollador trabaja sobre su propio **branch de BD** en Neon (los branches son gratis y aíslan los datos):

1. En el dashboard de Neon: **Branches → Create branch** (por ejemplo `dev-juan`).
2. Copiar las dos connection strings del branch:
   - `DATABASE_URL` → la URL **pooled** (host con sufijo `-pooler`): la usa la app en runtime.
   - `DIRECT_URL` → la URL **direct** (host sin `-pooler`): la usa `prisma migrate` (Neon no permite migraciones por el pooler).
3. Ambas con `?sslmode=require` y **sin** `channel_binding` (el pooler de Neon lo rechaza).

Comandos de Prisma:

```bash
npm run prisma:generate   # regenerar cliente tras tocar schema.prisma
npm run prisma:migrate    # desarrollo: crea/aplica migración (dev branch)
npm run prisma:deploy     # producción/CI: aplica migraciones pendientes
npm run prisma:seed       # usuarios y equipos demo
```

**Fallback local (sin internet):** `docker-compose.yml` levanta un Postgres 16 idéntico en local (`docker compose up -d db`); apunta `DATABASE_URL`/`DIRECT_URL` a `localhost:5432` y sigue usando los mismos comandos de Prisma.

## Scripts

| Comando                  | Descripción                                |
| ------------------------ | ------------------------------------------ |
| `npm run start:dev`      | Desarrollo con watch                       |
| `npm run build`          | Compilar a `dist/`                         |
| `npm run start:prod`     | Ejecutar `dist/main.js`                    |
| `npm test`               | Unit tests (Jest)                          |
| `npm run test:e2e`       | E2E (supertest; requiere BD configurada)   |
| `npm run test:cov`       | Cobertura                                  |
| `npm run lint`           | Lint (oxlint)                              |
| `npm run format`         | Prettier                                   |

## Docker

```bash
docker build -t scei-qr-api .
docker run -p 3000:3000 --env-file .env -v fotos:/app/uploads scei-qr-api
```

La imagen aplica `prisma migrate deploy` automáticamente al arrancar.

## CI (GitHub Actions)

`.github/workflows/ci.yml` ejecuta lint → unit tests → `migrate deploy` → e2e en cada push/PR.

**Secrets a configurar en el repo (Settings → Secrets and variables → Actions):**

| Secret               | Valor                                                    |
| -------------------- | -------------------------------------------------------- |
| `DATABASE_URL`       | Connection string pooled de la BD de CI (branch `ci`)    |
| `DIRECT_URL`         | Connection string directa de la misma BD                 |
| `JWT_SECRET`         | Secreto exclusivo para CI (no usar el de producción)     |

## Variables de entorno

Ver `.env.example`. Resumen:

- `DATABASE_URL` / `DIRECT_URL` — Neon (pooled / direct)
- `JWT_SECRET`, `JWT_EXPIRATION` (8 h, lo valida el cliente Flutter)
- `PORT`, `CORS_ORIGIN`
- `STORAGE_DRIVER=local`, `UPLOAD_DIR=uploads` — fotos de incidencias
- `FIREBASE_SERVICE_ACCOUNT` — **opcional**: JSON de la service account en base64. Sin él, el registro de tokens FCM funciona pero los envíos quedan en modo degradado (log + warn).

```bash
# Generar el valor de FIREBASE_SERVICE_ACCOUNT desde serviceAccount.json:
node -e "console.log(require('fs').readFileSync('serviceAccount.json','utf8').toString('base64'))"
```

## Estructura

```
src/
├── main.ts                  # bootstrap: dotenv, prefijo /api/v1, Swagger, pipes, filtros
├── app.module.ts
├── config/                  # app.config (registerAs 'app') + validateEnv
├── common/                  # guards (JWT + Roles), filtros, interceptores, PrismaService
└── modules/
    ├── auth/                # login/logout, JwtStrategy, payload { sub, username, role }
    ├── usuarios/            # CRUD de usuarios
    ├── equipos/             # CRUD + QR (PNG/SVG), resolver token, regenerar
    ├── usos/                # iniciar/finalizar/historial (un solo Uso ACTIVO por alumno)
    ├── incidencias/         # crear (foto multipart), tomar, estado, solución, historial
    ├── reportes/            # estadísticas + exportar xlsx/pdf
    └── notificaciones/      # registro de token FCM + push (Iteración 5)
prisma/
├── schema.prisma            # Usuario, Equipo, Uso, Incidencia + enums
├── migrations/
└── seed.ts
test/
└── app.e2e-spec.ts          # flujo completo DoD §7
```

## Reglas de negocio clave (§4 del arquitectura)

- Login inválido → **401** con mensaje **genérico** `Usuario o contraseña incorrectos`.
- Transiciones de incidencia solo en orden: `PENDIENTE → EN_ATENCION → RESUELTA` (409 si se intenta otra).
- **Tomar incidencia** es transaccional: si otro soporte/admin ya la tomó, responde **409**.
- Un alumno solo puede tener **un `Uso` ACTIVO** a la vez (409 al iniciar otro).
- Cambios de rol → 403 para cuentas distintas a la propia; la propia no puede cambiar su rol.
