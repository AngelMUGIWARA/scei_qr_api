import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoIncidencia } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CambiarEstadoDto,
  FilterIncidenciasDto,
  RegistrarSolucionDto,
} from './dto/incidencia.dto';

/**
 * Máquina de estados de las incidencias (arquitectura §4.2.3):
 * PENDIENTE → EN_ATENCION → RESUELTA. Cualquier transición fuera de orden
 * devuelve 409 Conflict.
 */
export const TRANSICIONES_VALIDAS: Record<EstadoIncidencia, EstadoIncidencia[]> = {
  PENDIENTE: [EstadoIncidencia.EN_ATENCION],
  EN_ATENCION: [EstadoIncidencia.RESUELTA],
  RESUELTA: [],
};

@Injectable()
export class IncidenciasService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly INCLUDE = {
    equipo: true,
    reportadaPor: { select: { id: true, username: true, fullName: true } },
    atendidaPor: { select: { id: true, username: true, fullName: true } },
  };

  /**
   * HU-AL-06: reportar incidencia (con foto opcional).
   */
  async crear(
    data: { equipoId: number; titulo: string; descripcion: string },
    reportadaPorId: number,
    fotoUrl?: string,
  ) {
    const equipo = await this.prisma.equipo.findUnique({
      where: { id: data.equipoId },
    });
    if (!equipo) throw new NotFoundException(`Equipo ${data.equipoId} no encontrado`);

    return this.prisma.incidencia.create({
      data: { ...data, reportadaPorId, fotoUrl },
      include: IncidenciasService.INCLUDE,
    });
  }

  /** HU-AL-07: mis reportes (el alumno ve solo los suyos). */
  findMisReportes(reportadaPorId: number) {
    return this.prisma.incidencia.findMany({
      where: { reportadaPorId },
      include: IncidenciasService.INCLUDE,
      orderBy: { creadaEn: 'desc' },
    });
  }

  /** HU-ST-02, HU-AD-09: listado para soporte/admin con filtros. */
  findAll(filters?: FilterIncidenciasDto) {
    return this.prisma.incidencia.findMany({
      where: {
        estado: filters?.estado,
        equipoId: filters?.equipoId ? parseInt(filters.equipoId, 10) : undefined,
      },
      include: IncidenciasService.INCLUDE,
      orderBy: { creadaEn: 'desc' },
    });
  }

  async findOne(id: number) {
    const incidencia = await this.prisma.incidencia.findUnique({
      where: { id },
      include: IncidenciasService.INCLUDE,
    });
    if (!incidencia) throw new NotFoundException(`Incidencia ${id} no encontrada`);
    return incidencia;
  }

  /**
   * HU-ST-04: tomar incidencia (PENDIENTE → EN_ATENCION).
   * Regla transaccional (arquitectura §4.2.4): si otro técnico ya la tomó,
   * el updateMany no matchea ninguna fila y devolvemos 409.
   */
  async tomar(id: number, tecnicoId: number) {
    await this.findOne(id);
    const result = await this.prisma.incidencia.updateMany({
      where: { id, estado: EstadoIncidencia.PENDIENTE },
      data: { estado: EstadoIncidencia.EN_ATENCION, atendidaPorId: tecnicoId },
    });
    if (result.count === 0) {
      throw new ConflictException(
        'La incidencia ya fue tomada por otro técnico o cambió de estado',
      );
    }
    return this.findOne(id);
  }

  /** HU-ST-05: cambio de estado (valida la máquina de estados). */
  async cambiarEstado(id: number, dto: CambiarEstadoDto) {
    const incidencia = await this.findOne(id);
    const permitidas = TRANSICIONES_VALIDAS[incidencia.estado];
    if (!permitidas.includes(dto.estado)) {
      throw new ConflictException(
        `Transición no permitida: ${incidencia.estado} → ${dto.estado}. ` +
          `Estados válidos desde aquí: ${permitidas.join(', ') || 'ninguno (resuelta)'}`,
      );
    }
    await this.prisma.incidencia.update({
      where: { id },
      data: { estado: dto.estado },
    });
    return this.findOne(id);
  }

  /**
   * HU-ST-06: registrar solución (→ RESUELTA + texto).
   * Solo puede resolverse una incidencia que esté EN_ATENCION.
   */
  async registrarSolucion(id: number, dto: RegistrarSolucionDto, tecnicoId: number) {
    const incidencia = await this.findOne(id);
    if (incidencia.estado !== EstadoIncidencia.EN_ATENCION) {
      throw new ConflictException(
        'Solo puede registrarse solución en una incidencia EN_ATENCION. ' +
          `Estado actual: ${incidencia.estado}.`,
      );
    }
    await this.prisma.incidencia.update({
      where: { id },
      data: {
        estado: EstadoIncidencia.RESUELTA,
        solucion: dto.solucion,
        atendidaPorId: incidencia.atendidaPorId ?? tecnicoId,
      },
    });
    return this.findOne(id);
  }

  /**
   * HU-ST-07: historial de incidencias (todas con su trazabilidad),
   * con filtros opcionales por estado y técnico.
   */
  findHistorial(params?: { estado?: EstadoIncidencia; tecnicoId?: number }) {
    return this.prisma.incidencia.findMany({
      where: {
        estado: params?.estado,
        atendidaPorId: params?.tecnicoId,
      },
      include: IncidenciasService.INCLUDE,
      orderBy: { actualizadaEn: 'desc' },
    });
  }
}
