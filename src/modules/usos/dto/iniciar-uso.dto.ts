import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Body de POST /usos: el alumno escanea el QR y envía su token. */
export class IniciarUsoDto {
  @ApiProperty({
    example: '7f9a1c2e-....',
    description: 'Contenido del QR escaneado (qrToken del equipo)',
  })
  @IsString()
  @IsNotEmpty()
  qrToken: string;
}
