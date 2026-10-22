import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'alumno1', description: 'Usuario asignado' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '••••••••', description: 'Contraseña del usuario' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
