import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import appConfig from './config/app.config';
import { PrismaModule } from './common/prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { EquiposModule } from './modules/equipos/equipos.module';
import { UsosModule } from './modules/usos/usos.module';
import { IncidenciasModule } from './modules/incidencias/incidencias.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    // Fotos de incidencias servidas en /uploads (STORAGE_DRIVER=local)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', process.env.UPLOAD_DIR ?? 'uploads'),
      serveRoot: '/uploads',
      exclude: ['/api/(.*)'],
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsuariosModule,
    EquiposModule,
    UsosModule,
    IncidenciasModule,
    ReportesModule,
    NotificacionesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guards globales (HU-GEN-01): primero JWT, luego control por rol
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
