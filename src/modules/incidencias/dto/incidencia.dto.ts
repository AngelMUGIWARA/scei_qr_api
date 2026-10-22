import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoIncidencia } from '@prisma/client';

/** Campos de texto del formulario de incidencia (multipart los mezcla con la foto). */
export class CreateIncidenciaDto {
  @ApiProperty({ example: 'Monitor sin imagen' })
  @IsString()
  @IsNotEmpty()
  equipoId: string;

  @ApiProperty({ example: 'Monitor sin imagen' })
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @ApiProperty({ example: 'El monitor enciende pero no muestra imagen, solo el piloto azul parpadea.' })
  @IsString()
  @IsNotEmpty()
  descripcion: string;
}

/** HU-ST-05: cambio de estado manual del técnico. */
export class CambiarEstadoDto {
  @ApiProperty({ enum: EstadoIncidencia, example: 'EN_ATENCION' })
  @IsEnum(EstadoIncidencia)
  estado: EstadoIncidencia;
}

/** HU-ST-06: registrar solución (pasado a RESUELTA + texto). */
export class RegistrarSolucionDto {
  @ApiProperty({ example: 'Se reemplacó el cable de poder; probado OK.' })
  @IsString()
  @IsNotEmpty()
  solucion: string;
}

/** Filtros para GET /incidencias (HU-ST-02, HU-AD-09). */
export class FilterIncidenciasDto {
  @ApiPropertyOptional({ enum: EstadoIncidencia, example: 'PENDIENTE' })
  @IsOptional()
  @IsEnum(EstadoIncidencia)
  estado?: EstadoIncidencia;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  equipoId?: string;
}
