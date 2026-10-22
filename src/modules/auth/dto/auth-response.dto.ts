import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'alumno1' })
  username: string;

  @ApiProperty({ example: 'Juan Pérez' })
  fullName: string;

  @ApiProperty({ example: 'ALUMNO', enum: ['ALUMNO', 'SOPORTE', 'ADMIN'] })
  rol: string;
}

/**
 * Contrato de respuesta de login (calza con AuthResponseModel del cliente Flutter).
 * El cliente decodifica el token y valida `exp` con jwt_decoder (arquitectura §4.2).
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT firmado. Payload: { sub, username, role }. Expira en 8h.',
  })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 28800, description: 'Segundos hasta la expiración' })
  expiresIn: number;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
