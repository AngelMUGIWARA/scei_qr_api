import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Rol } from '@prisma/client';

export class CreateUsuarioDto {
  @ApiProperty({ example: 'alumno1' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '••••••••', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Juan Pérez López' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'ALUMNO', enum: Rol })
  @IsEnum(Rol)
  rol: Rol;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** HU-AD-03/12: PATCH parcial; password vacío = no cambiar. */
export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {}
