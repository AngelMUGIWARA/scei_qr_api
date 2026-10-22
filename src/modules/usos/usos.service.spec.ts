import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EstadoUso } from '@prisma/client';
import { UsosService } from './usos.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * DoD §7: uso duplicado (solo UN uso ACTIVO por alumno a la vez -> 409).
 */
describe('UsosService', () => {
  let service: UsosService;
  let prisma: {
    uso: { findFirst: jest.Mock; create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    equipo: { findUnique: jest.Mock };
  };

  const equipo1 = {
    id: 1,
    codigo: 'LAB-PC-001',
    nombre: 'PC Dell',
    ubicacion: 'Lab 1',
    qrToken: 'token-qr-1',
    activo: true,
  };
  const equipo2 = { ...equipo1, id: 2, codigo: 'LAB-PC-002', qrToken: 'token-qr-2' };

  beforeEach(async () => {
    prisma = {
      uso: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      equipo: { findUnique: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [UsosService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UsosService);
  });

  it('inicia uso cuando el alumno no tiene uso activo', async () => {
    prisma.equipo.findUnique.mockResolvedValue(equipo1);
    prisma.uso.findFirst.mockResolvedValue(null);
    prisma.uso.create.mockResolvedValue({
      id: 100,
      alumnoId: 3,
      equipoId: 1,
      estado: EstadoUso.ACTIVO,
      equipo: equipo1,
    });

    const result = await service.iniciar({ qrToken: 'token-qr-1' }, 3);

    expect(prisma.uso.create).toHaveBeenCalledWith({
      data: { alumnoId: 3, equipoId: 1 },
      include: { equipo: true },
    });
    expect(result.estado).toBe(EstadoUso.ACTIVO);
  });

  it('escanear otro QR con uso activo -> 409 (uso único)', async () => {
    prisma.equipo.findUnique.mockResolvedValue(equipo2);
    prisma.uso.findFirst.mockResolvedValue({
      id: 99,
      alumnoId: 3,
      equipoId: 1,
      estado: EstadoUso.ACTIVO,
      equipo: equipo1,
    });

    await expect(service.iniciar({ qrToken: 'token-qr-2' }, 3)).rejects.toThrow(
      ConflictException,
    );
    await expect(service.iniciar({ qrToken: 'token-qr-2' }, 3)).rejects.toThrow(
      /Ya tiene un uso activo/,
    );
    expect(prisma.uso.create).not.toHaveBeenCalled();
  });

  it('QR inexistente -> 404', async () => {
    prisma.equipo.findUnique.mockResolvedValue(null);

    await expect(
      service.iniciar({ qrToken: 'no-existe' }, 3),
    ).rejects.toThrow(NotFoundException);
  });

  it('QR de equipo inactivo -> 404', async () => {
    prisma.equipo.findUnique.mockResolvedValue({ ...equipo1, activo: false });

    await expect(
      service.iniciar({ qrToken: 'token-qr-1' }, 3),
    ).rejects.toThrow(NotFoundException);
  });

  it('finalizar uso ya finalizado -> 409', async () => {
    prisma.uso.findUnique.mockResolvedValue({
      id: 100,
      alumnoId: 3,
      equipoId: 1,
      estado: EstadoUso.FINALIZADO,
      equipo: equipo1,
    });

    await expect(service.finalizar(100, 3)).rejects.toThrow(ConflictException);
  });

  it('no puedo finalizar el uso de otro alumno -> 403', async () => {
    prisma.uso.findUnique.mockResolvedValue({
      id: 100,
      alumnoId: 999,
      equipoId: 1,
      estado: EstadoUso.ACTIVO,
      equipo: equipo1,
    });

    await expect(service.finalizar(100, 3)).rejects.toThrow(
      /Solo puede finalizar sus propios usos/,
    );
  });
});
