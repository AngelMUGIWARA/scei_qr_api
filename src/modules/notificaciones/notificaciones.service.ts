import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Servicio de notificaciones push FCM (HU-AL-09, HU-ST-08).
 * Iteración 5: si no hay credenciales de Firebase en el entorno, el servicio
 * queda en modo degradado (log y no-op) para no bloquear el resto del sistema.
 */
@Injectable()
export class NotificacionesService implements OnModuleInit {
  private readonly logger = new Logger(NotificacionesService.name);
  private firebaseEnabled = false;
  private messaging: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const serviceAccount = this.config.get<string>('app.firebaseServiceAccount');
    if (!serviceAccount) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT no configurado: notificaciones push deshabilitadas (Iteración 5).',
      );
      return;
    }
    try {
      const admin = await import('firebase-admin');
      const json = JSON.parse(Buffer.from(serviceAccount, 'base64').toString('utf8'));
      if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(json) });
      }
      this.messaging = admin.messaging();
      this.firebaseEnabled = true;
      this.logger.log('Firebase Admin inicializado: push habilitado.');
    } catch (error) {
      this.logger.error('Error inicializando Firebase Admin', error as Error);
    }
  }

  /**
   * HU-AL-09: avisar al alumno cuando su incidencia cambia de estado.
   * HU-ST-08: avisar a soporte cuando hay una nueva incidencia pendiente.
   */
  async notificarCambioIncidencia(
    incidenciaId: number,
    mensaje: string,
    destinatarios: Array<{ fcmToken: string | null }>,
  ): Promise<void> {
    if (!this.firebaseEnabled) return;
    const tokens = destinatarios
      .map((d) => d.fcmToken)
      .filter((t): t is string => Boolean(t));
    if (tokens.length === 0) return;

    try {
      await this.messaging.sendEachForMulticast({
        tokens,
        notification: { title: 'scei_qr', body: mensaje },
        data: { incidenciaId: String(incidenciaId) },
      });
    } catch (error) {
      this.logger.error('Error enviando push', error as Error);
    }
  }

  /** Registra/actualiza el token FCM del usuario (HU-AL-09). */
  async registrarToken(userId: number, token: string) {
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { fcmToken: token },
    });
    return { registered: true };
  }

  async getTokensByRol(rol: 'ALUMNO' | 'SOPORTE' | 'ADMIN') {
    return this.prisma.usuario.findMany({
      where: { rol, activo: true, fcmToken: { not: null } },
      select: { fcmToken: true },
    });
  }
}
