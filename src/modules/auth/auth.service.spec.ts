import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * HU-AL-01 / HU-ST-01 / HU-AD-01 (DoD §7): login ok / credenciales inválidas /
 * cuenta inactiva. CA: los dos errores inválidos responden el MISMO mensaje.
 */
describe('AuthService', () => {
  let service: AuthService;
  let prisma: { usuario: { findUnique: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  const userActive = {
    id: 1,
    username: 'alumno1',
    fullName: 'Lucía Fernández (Alumna)',
    rol: 'ALUMNO',
    activo: true,
    // hash de 'Password123!' (generado con bcrypt, cost 4 en tests)
    passwordHash:
      '$2b$04$ZqO0nQbVvJ5oJ5oJ5oJ5ouJ5oJ5oJ5oJ5oJ5oJ5oJ5oJ5oJ5oJ5oJ5O',
  };

  beforeEach(async () => {
    prisma = { usuario: { findUnique: jest.fn() } };
    jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: 'CONFIGURATION_app', useValue: {} },
      ],
    })
      .useMocker((token) => {
        // ConfigService.get('app.jwtExpiration') -> '8h'
        if (String(token).includes('Config')) {
          return { get: jest.fn().mockReturnValue('8h') };
        }
      })
      .compile();

    service = moduleRef.get(AuthService);
  });

  it('login válido devuelve accessToken, user y expiresIn=28800', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('Password123!', 4);
    prisma.usuario.findUnique.mockResolvedValue({ ...userActive, passwordHash: hash });

    const result = await service.login({
      username: 'alumno1',
      password: 'Password123!',
    });

    expect(result.accessToken).toBe('jwt-token');
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(28800); // 8h
    expect(result.user).toEqual({
      id: 1,
      username: 'alumno1',
      fullName: 'Lucía Fernández (Alumna)',
      rol: 'ALUMNO',
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: 1, username: 'alumno1', role: 'ALUMNO' },
      { expiresIn: 28800 },
    );
  });

  it('credenciales inválidas -> 401 genérico', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('otra-password', 4);
    prisma.usuario.findUnique.mockResolvedValue({ ...userActive, passwordHash: hash });

    await expect(
      service.login({ username: 'alumno1', password: 'mala' }),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.login({ username: 'alumno1', password: 'mala' }),
    ).rejects.toThrow('Usuario o contraseña incorrectos');
  });

  it('usuario inexistente -> 401 con el MISMO mensaje genérico (no revela)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ username: 'noexiste', password: 'cualquiera123' }),
    ).rejects.toThrow('Usuario o contraseña incorrectos');
  });

  it('usuario inactivo -> 401 genérico (cuenta bloqueada)', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('Password123!', 4);
    prisma.usuario.findUnique.mockResolvedValue({
      ...userActive,
      activo: false,
      passwordHash: hash,
    });

    await expect(
      service.login({ username: 'alumno1', password: 'Password123!' }),
    ).rejects.toThrow('Usuario o contraseña incorrectos');
  });
});
