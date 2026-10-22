import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { EquiposService } from './equipos.service';
import { CreateEquipoDto, UpdateEquipoDto } from './dto/equipo.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('equipos')
@ApiBearerAuth('jwt')
@Controller('equipos')
export class EquiposController {
  constructor(private readonly equiposService: EquiposService) {}

  /** HU-AD-05: listar equipos (autenticado). */
  @Get()
  @ApiOperation({ summary: 'Listar equipos (HU-AD-05)' })
  findAll(
    @Query('activo') activo?: string,
    @Query('q') q?: string,
    @Query('ubicacion') ubicacion?: string,
  ) {
    return this.equiposService.findAll({
      activo: activo === undefined ? undefined : activo === 'true',
      q: q || undefined,
      ubicacion: ubicacion || undefined,
    });
  }

  /** HU-AD-04: crear equipo (ADMIN). */
  @Roles('ADMIN')
  @Post()
  @ApiOperation({ summary: 'Crear equipo (HU-AD-04)' })
  create(@Body() dto: CreateEquipoDto) {
    return this.equiposService.create(dto);
  }

  /**
   * HU-AL-02, HU-ST-03: resolver QR escaneado (autenticado).
   * IMPORTANTE: esta ruta debe ir antes de GET /equipos/:id para no ser
   * capturada por el parámetro :id. NestJS no garantiza orden, por eso el
   * prefijo es explícito "qr/:qrToken".
   */
  @Get('qr/:qrToken')
  @ApiOperation({ summary: 'Resolver QR escaneado (HU-AL-02, HU-ST-03)' })
  resolveQr(@Param('qrToken') qrToken: string) {
    return this.equiposService.resolveQrToken(qrToken);
  }

  /** HU-AD-05: detalle de equipo (autenticado). */
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de equipo' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.equiposService.findOne(id);
  }

  /** HU-AD-05: editar equipo (ADMIN). */
  @Roles('ADMIN')
  @Patch(':id')
  @ApiOperation({ summary: 'Editar equipo (HU-AD-05)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEquipoDto,
  ) {
    return this.equiposService.update(id, dto);
  }

  /** HU-AD-06: descargar el QR del equipo (ADMIN). */
  @Roles('ADMIN')
  @Get(':id/qr')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Descargar QR del equipo (HU-AD-06)' })
  async getQr(
    @Param('id', ParseIntPipe) id: number,
    @Query('format') format: 'png' | 'svg' = 'png',
    @Res() res: Response,
  ) {
    const buffer = await this.equiposService.getQrImage(id, format);
    res
      .set({
        'Content-Type': format === 'svg' ? 'image/svg+xml' : 'image/png',
        'Content-Disposition': `inline; filename="equipo-${id}-qr.${format}"`,
      })
      .send(buffer);
  }

  /** HU-AD-07: regenerar QR (ADMIN). */
  @Roles('ADMIN')
  @Post(':id/regenerar-qr')
  @ApiOperation({ summary: 'Regenerar QR del equipo (HU-AD-07)' })
  regenerateQr(@Param('id', ParseIntPipe) id: number) {
    return this.equiposService.regenerateQr(id);
  }
}
