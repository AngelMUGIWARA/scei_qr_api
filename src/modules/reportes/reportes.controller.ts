import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportesService } from './reportes.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('reportes')
@ApiBearerAuth('jwt')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  /** HU-AD-10: estadísticas (ADMIN). */
  @Roles('ADMIN')
  @Get('estadisticas')
  @ApiOperation({ summary: 'Estadísticas generales (HU-AD-10)' })
  getEstadisticas() {
    return this.reportesService.getEstadisticas();
  }

  /** HU-AD-11: exportar xlsx/pdf (ADMIN). */
  @Roles('ADMIN')
  @Get('exportar')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Exportar reporte en xlsx o pdf (HU-AD-11)' })
  async exportar(
    @Query('format') format: string = 'xlsx',
    @Res() res: Response,
  ) {
    const formato = format === 'pdf' ? 'pdf' : 'xlsx';
    const { buffer, filename, contentType } =
      await this.reportesService.exportar(formato);
    res
      .set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      .send(buffer);
  }
}
