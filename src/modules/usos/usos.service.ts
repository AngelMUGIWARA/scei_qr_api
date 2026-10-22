import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoUso } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IniciarUsoDto } from './dto/iniciar-uso.dto';

@Injectable()
export class UsosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * HU-AL-03: iniciar uso escaneando el QR del equipo.
   * Regla de negocio (arquitectura §4.2.5): solo UN uso ACTIVO por alumno.
   * Escanear otro QR con uso activo -> 409.
   */
  async iniciar(dto: IniciarUsoDto, alumnoId: number) {
    const equipo = await this.prisma.equipo.findUnique({
      where: { qrToken: dto.qrToken },
    });
    if (!equipo || !equipo.activo) {
      throw new NotFoundException('QR no válido o equipo inactivo');
    }

    const usoActivo = await this.prisma.uso.findFirst({
      where: { alumnoId, estado: EstadoUso.ACTIVO },
      include: { equipo: true },
    });

    if (usoActivo) {
      const mismoEquipo = usoActivo.equipoId === equipo.id;
      throw new ConflictException(
        mismoEquipo
          ? 'Ya tiene un uso activo para este equipo. Finalícelo antes de iniciar otro.'
          : `Ya tiene un uso activo del equipo "${usoActivo.equipo.codigo}". ` +
            'Finalícelo antes de escanear otro QR.',
      );
    }

    return this.prisma.uso.create({
      data: { alumnoId, equipoId: equipo.id },
      include: { equipo: true },
    });
  }

  /**
   * HU-AL-04: finalizar uso.
   * Solo el dueño del uso puede finalizarlo; no puede ser de otro alumno
   * ni estar ya finalizado.
   */
  async finalizar(id: number, alumnoId: number) {
    const uso = await this.prisma.uso.findUnique({
      where: { id },
      include: { equipo: true },
    });
    if (!uso) throw new NotFoundException(`Uso ${id} no encontrado`);
    if (uso.alumnoId !== alumnoId) {
      throw new ForbiddenException('Solo puede finalizar sus propios usos');
    }
    if (uso.estado === EstadoUso.FINALIZADO) {
      throw new ConflictException('El uso ya fue finalizado');
    }
    return this.prisma.uso.update({
      where: { id },
      data: { fin: new Date(), estado: EstadoUso.FINALIZADO },
      include: { equipo: true },
    });
  }

  /** HU-AL-05: historial personal del alumno. */
  findMisRegistros(alumnoId: number) {
    return this.prisma.uso.findMany({
      where: { alumnoId },
      include: { equipo: true },
      orderBy: { inicio: 'desc' },
    });
  }

  /**
   * HU-AD-08: historial de un equipo para el administrador.
   * Permite validar el uso de los equipos (estadística y auditoría).
   */
  findHistorial(equipoId: number, alumnoId?: number) {
    return this.prisma.uso.findMany({
      where: {
        equipoId,
        ...(alumnoId ? { alumnoId } : {}),
      },
      include: {
        equipo: true,
        alumno: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: { inicio: 'desc' },
    });
  }
}
