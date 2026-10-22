import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { expirationToSeconds } from '../../common/utils/expiration.util';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * HU-AL-01 / HU-ST-01 / HU-AD-01: login único para los 3 roles.
   * CA (arquitectura §4.2.1): credenciales inválidas Y cuenta inactiva devuelven
   * el MISMO error genérico 401, sin revelar cuál falló.
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.usuario.findUnique({
      where: { username: dto.username },
    });

    const invalid =
      !user || !(await bcrypt.compare(dto.password, user.passwordHash));

    if (invalid || !user.activo) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.rol,
    };

    const expiresIn = this.config.get<string>('app.jwtExpiration') ?? '8h';
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: expirationToSeconds(expiresIn),
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: expirationToSeconds(expiresIn),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        rol: user.rol,
      },
    };
  }

  /**
   * HU-GEN-02: logout.
   * El JWT es stateless (sin blacklist); el cliente descarta el token.
   * Se expone el endpoint para dejar constancia y dar simetría al contrato.
   */
  async logout(userId: number): Promise<{ message: string }> {
    // Futuro Iteración 5: si se agrega revocación server-side, se hace aquí.
    void userId;
    return { message: 'Sesión cerrada' };
  }
}
