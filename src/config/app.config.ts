import { registerAs } from '@nestjs/config';

/**
 * Configuración tipada de la aplicación.
 * Se accede via ConfigService (inyectable): config.get('app.jwtSecret'), etc.
 * registerAs('app', ...) la registra bajo el namespace 'app'.
 */
export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION ?? '8h',
  storageDriver: process.env.STORAGE_DRIVER ?? 'local',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  corsOrigins: (process.env.CORS_ORIGIN ?? '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
}));

export function validateEnv(env: Record<string, string | undefined>): void {
  const required = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET'];
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno obligatorias: ${missing.join(', ')}. ` +
        'Copia .env.example a .env y completa los valores.',
    );
  }
}
