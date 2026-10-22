import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

/**
 * Almacenamiento de fotos de incidencias (HU-AL-08).
 * Driver local por ahora; S3/Cloudinary quedan preparados para Iteración 5
 * (mismo contrato, otro driver en la fábrica).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: string;
  private readonly uploadDir: string;

  constructor(config: ConfigService) {
    this.driver = config.get<string>('app.storageDriver') ?? 'local';
    this.uploadDir = config.get<string>('app.uploadDir') ?? 'uploads';
  }

  async saveIncidentPhoto(file: UploadedFile): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo vacío');
    }
    if (this.driver !== 'local') {
      // Iteración 5: s3 / cloudinary
      this.logger.warn(
        `STORAGE_DRIVER=${this.driver} aún no implementado; usando driver local.`,
      );
    }
    const dir = join(process.cwd(), this.uploadDir, 'incidencias');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const ext = this.sanitizeExtension(file.originalname, file.mimetype);
    const filename = `${randomUUID()}${ext}`;
    await writeFile(join(dir, filename), file.buffer);
    // URL relativa servida por ServeStaticModule (/uploads)
    return `/uploads/incidencias/${filename}`;
  }

  private sanitizeExtension(originalname: string, mimetype: string): string {
    const extFromName = /\.[a-z0-9]{2,5}$/i.exec(originalname ?? '')?.[0]?.toLowerCase();
    const allowed: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/heic': '.heic',
    };
    const ext = allowed[mimetype] ?? extFromName;
    if (!ext || !Object.values(allowed).includes(ext)) {
      throw new BadRequestException('Formato de imagen no soportado (jpg, png, webp, heic)');
    }
    return ext;
  }
}
