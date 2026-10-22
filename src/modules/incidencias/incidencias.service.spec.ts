import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EstadoIncidencia } from '@prisma/client';
import {
  IncidenciasService,
  TRANSICIONES_VALIDAS,
} from './incidencias.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * DoD §7: transiciones válidas e inválidas + "tomar" en paralelo.
 */
describe('IncidenciasService', () => {
  let service: IncidenciasService;
  let prisma: {
    incidencia: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
    equipo: { findUnique: jest.Mock };
  };

  const incidenciaBase = {
    id: 10,
    equipoId: 1,
    reportadaPorId: 3,
    atendidaPorId: null as number | null,
    titulo: 'Monitor sin imagen',
    descripcion: 'No da imagen',
    fotoUrl: null as string | null,
    estado: EstadoIncidencia.PENDIENTE,
    solucion: null as string | null,
    creadaEn: new Date(),
    actualizadaEn: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      incidencia: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      equipo: { findUnique: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IncidenciasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(IncidenciasService);
  });

  describe('máquina de estados', () => {
    it('solo permite PENDIENTE → EN_ATENCION → RESUELTA', () => {
      expect(TRANSICIONES_VALIDAS.PENDIENTE).toEqual([
        EstadoIncidencia.EN_ATENCION,
      ]);
      expect(TRANSICIONES_VALIDAS.EN_ATENCION).toEqual([
        EstadoIncidencia.RESUELTA,
      ]);
      expect(TRANSICIONES_VALIDAS.RESUELTA).toEqual([]);
    });

    it('PENDIENTE → RESUELTA directa -> 409 (fuera de orden)', async () => {
      prisma.incidencia.findUnique.mockResolvedValue({
        ...incidenciaBase,
        estado: EstadoIncidencia.PENDIENTE,
      });

      await expect(
        service.cambiarEstado(10, { estado: EstadoIncidencia.RESUELTA }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.cambiarEstado(10, { estado: EstadoIncidencia.RESUELTA }),
      ).rejects.toThrow(/Transición no permitida/);
      expect(prisma.incidencia.update).not.toHaveBeenCalled();
    });

    it('RESUELTA no admite más cambios -> 409', async () => {
      prisma.incidencia.findUnique.mockResolvedValue({
        ...incidenciaBase,
        estado: EstadoIncidencia.RESUELTA,
      });

      await expect(
        service.cambiarEstado(10, { estado: EstadoIncidencia.EN_ATENCION }),
      ).rejects.toThrow(ConflictException);
    });

    it('PENDIENTE → EN_ATENCION válida -> actualiza', async () => {
      prisma.incidencia.findUnique
        .mockResolvedValueOnce({
          ...incidenciaBase,
          estado: EstadoIncidencia.PENDIENTE,
        })
        .mockResolvedValueOnce({
          ...incidenciaBase,
          estado: EstadoIncidencia.EN_ATENCION,
        });
      prisma.incidencia.update.mockResolvedValue({});

      const result = await service.cambiarEstado(10, {
        estado: EstadoIncidencia.EN_ATENCION,
      });

      expect(prisma.incidencia.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { estado: EstadoIncidencia.EN_ATENCION },
      });
      expect(result.estado).toBe(EstadoIncidencia.EN_ATENCION);
    });
  });

  describe('solución (HU-ST-06)', () => {
    it('solo resuelve incidencias EN_ATENCION -> 409 en caso contrario', async () => {
      prisma.incidencia.findUnique.mockResolvedValue({
        ...incidenciaBase,
        estado: EstadoIncidencia.PENDIENTE,
      });

      await expect(
        service.registrarSolucion(10, { solucion: 'x' }, 2),
      ).rejects.toThrow(ConflictException);
    });

    it('EN_ATENCION -> RESUELTA con texto de solución', async () => {
      prisma.incidencia.findUnique
        .mockResolvedValueOnce({
          ...incidenciaBase,
          estado: EstadoIncidencia.EN_ATENCION,
          atendidaPorId: 2,
        })
        .mockResolvedValueOnce({
          ...incidenciaBase,
          estado: EstadoIncidencia.RESUELTA,
          solucion: 'Se cambió el cable',
          atendidaPorId: 2,
        });
      prisma.incidencia.update.mockResolvedValue({});

      const result = await service.registrarSolucion(
        10,
        { solucion: 'Se cambió el cable' },
        2,
      );

      expect(prisma.incidencia.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          estado: EstadoIncidencia.RESUELTA,
          solucion: 'Se cambió el cable',
          atendidaPorId: 2,
        },
      });
      expect(result.estado).toBe(EstadoIncidencia.RESUELTA);
    });
  });

  describe('tomar incidencia (HU-ST-04, condición transaccional)', () => {
    it('éxito cuando estaba PENDIENTE (count=1)', async () => {
      prisma.incidencia.findUnique
        .mockResolvedValueOnce({ ...incidenciaBase })
        .mockResolvedValueOnce({
          ...incidenciaBase,
          estado: EstadoIncidencia.EN_ATENCION,
          atendidaPorId: 2,
        });
      prisma.incidencia.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.tomar(10, 2);

      expect(prisma.incidencia.updateMany).toHaveBeenCalledWith({
        where: { id: 10, estado: EstadoIncidencia.PENDIENTE },
        data: { estado: EstadoIncidencia.EN_ATENCION, atendidaPorId: 2 },
      });
      expect(result.estado).toBe(EstadoIncidencia.EN_ATENCION);
    });

    it('conflicto cuando otro técnico ya la tomó (count=0) -> 409', async () => {
      prisma.incidencia.findUnique.mockResolvedValue({
        ...incidenciaBase,
        estado: EstadoIncidencia.EN_ATENCION,
        atendidaPorId: 99,
      });
      prisma.incidencia.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.tomar(10, 2)).rejects.toThrow(ConflictException);
      await expect(service.tomar(10, 2)).rejects.toThrow(
        /ya fue tomada por otro técnico/,
      );
    });
  });
});
