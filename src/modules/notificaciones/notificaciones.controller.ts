import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { NotificacionesService } from './notificaciones.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class RegistrarTokenDto {
  @ApiProperty({
    example: 'fcm-device-token...',
    description: 'Token FCM del dispositivo móvil',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}

@ApiTags('notificaciones')
@ApiBearerAuth('jwt')
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  /**
   * HU-AL-09: el cliente registra su token FCM tras el login
   * (o al instalar la app) para recibir push.
   */
  @Post('token')
  @ApiOperation({ summary: 'Registrar token FCM del dispositivo (HU-AL-09)' })
  registrarToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegistrarTokenDto,
  ) {
    return this.notificacionesService.registrarToken(user.userId, dto.token);
  }
}
