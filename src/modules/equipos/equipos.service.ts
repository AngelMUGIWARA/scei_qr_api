import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEquipoDto, UpdateEquipoDto } from './dto/equipo.dto';

@Injectable()
export class EquiposService {
  constructor(private readonly prisma: PrismaService) {}

  /** HU-AD-05: listado (cualquier usuario autenticado). */
  findAll(params?: { activo?: boolean; q?: string; ubicacion?: string }) {
    return this.prisma.equipo.findMany({
      where: {
        activo: params?.activo,
        ubicacion: params?.ubicacion
          ? { contains: params.ubicacion, mode: 'insensitive' }
          : undefined,
        ...(params?.q
          ? {
              OR: [
                { codigo: { contains: params.q, mode: 'insensitive' } },
                { nombre: { contains: params.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { codigo: 'asc' },
    });
  }

  async findOne(id: number) {
    const equipo = await this.prisma.equipo.findUnique({ where: { id } });
    if (!equipo) throw new NotFoundException(`Equipo ${id} no encontrado`);
    return equipo;
  }

  /**
   * HU-AD-04: crear equipo.
   * El qrToken único se genera aquí (HU-AD-06): el QR impreso lo lleva
   * el equipo y el alumno lo escanea para iniciar uso.
   */
  async create(dto: CreateEquipoDto) {
    const exists = await this.prisma.equipo.findUnique({
      where: { codigo: dto.codigo },
    });
    if (exists) {
      throw new ConflictException(`El código "${dto.codigo}" ya está registrado`);
    }
    return this.prisma.equipo.create({
      data: { ...dto, qrToken: randomUUID() },
    });
  }

  /** HU-AD-05: editar equipo. */
  async update(id: number, dto: UpdateEquipoDto) {
    await this.findOne(id);
    return this.prisma.equipo.update({ where: { id }, data: dto });
  }

  /**
   * HU-AD-06: obtener la imagen del QR (PNG por defecto, SVG opcional).
   */
  async getQrImage(id: number, format: 'png' | 'svg' = 'png'): Promise<Buffer> {
    const equipo = await this.findOne(id);
    if (format === 'svg') {
      const svg = await QRCode.toString(equipo.qrToken, { type: 'svg' });
      return Buffer.from(svg, 'utf8');
    }
    return QRCode.toBuffer(equipo.qrToken, {
      type: 'png',
      width: 400,
      margin: 2,
    });
  }

  /**
   * HU-AL-02, HU-ST-03: resolver el QR escaneado.
   * Devuelve los datos del equipo para que el cliente muestre la ficha.
   */
  async resolveQrToken(qrToken: string) {
    const equipo = await this.prisma.equipo.findUnique({
      where: { qrToken },
    });
    if (!equipo || !equipo.activo) {
      throw new NotFoundException('QR no válido o equipo inactivo');
    }
    return equipo;
  }

  /** HU-AD-07: regenerar el QR (si se pierde la etiqueta física). */
  async regenerateQr(id: number) {
    await this.findOne(id);
    return this.prisma.equipo.update({
      where: { id },
      data: { qrToken: randomUUID() },
    });
  }
}
