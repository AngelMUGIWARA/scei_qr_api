import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { expirationToSeconds } from '../../common/utils/expiration.util';

@Module({
  imports: [
    PassportModule,
    // ConfigModule es global (forRoot isGlobal), por eso NO importamos el
    // ConfigModule plano aquí: hacerlo crea una instancia aislada que no ve
    // la config cargada (appConfig) y el secret quedaría undefined.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwtSecret'),
        signOptions: {
          expiresIn: expirationToSeconds(
            config.get<string>('app.jwtExpiration'),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
