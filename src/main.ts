import 'dotenv/config'; // carga .env en process.env ANTES de validateEnv
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { validateEnv } from './config/app.config';

async function bootstrap() {
  validateEnv(process.env);

  const app = await NestFactory.create(AppModule);

  // Base: /api/v1 (arquitectura §4)
  app.setGlobalPrefix('api/v1');

  // CORS para la app Flutter (dev: web/local, prod: dominio de la institución)
  const origins = (process.env.CORS_ORIGIN ?? '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });

  // DTOs: whitelist elimina campos no declarados, transform convierte tipos
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger: fuente de verdad del contrato (arquitectura §9)
  const config = new DocumentBuilder()
    .setTitle('scei_qr API')
    .setDescription(
      'API del sistema de control de equipos por QR (scei_qr). ' +
        'Contrato consumido por la app Flutter.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger en http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
