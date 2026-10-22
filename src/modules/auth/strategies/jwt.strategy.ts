import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../../common/decorators/current-user.decorator';

/**
 * Estrategia JWT: decodifica el token y lo convierte en request.user.
 * Contrato asumido por el cliente Flutter: payload { sub, username, role }.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwtSecret') ?? 'dev-secret',
    });
  }

  validate(payload: { sub: number; username: string; role: string }): AuthUser {
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role as AuthUser['role'],
    };
  }
}
