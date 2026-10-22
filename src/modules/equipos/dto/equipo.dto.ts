import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateEquipoDto {
  @ApiProperty({ example: 'LAB-PC-001', description: 'Código interno único' })
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @ApiProperty({ example: 'PC Dell OptiPlex 7090' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({ example: 'Equipo de cómputo para talleres' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: 'Laboratorio 2, Fila A' })
  @IsString()
  @IsNotEmpty()
  ubicacion: string;
}

export class UpdateEquipoDto extends PartialType(CreateEquipoDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
