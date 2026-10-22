import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EstadoIncidencia } from '@prisma/client';
import { IncidenciasService } from './incidencias.service';
import {
  CambiarEstadoDto,
  FilterIncidenciasDto,
  RegistrarSolucionDto,
} from './dto/incidencia.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageService } from '../../common/storage/storage.service';

@ApiTags('incidencias')
@ApiBearerAuth('jwt')
@Controller('incidencias')
export class IncidenciasController {
  constructor(
    private readonly incidenciasService: IncidenciasService,
    private readonly storage: StorageService,
  ) {}

  /**
   * HU-AL-06: reportar incidencia (ALUMNO).
   * multipart/form-data: equipoId, titulo, descripcion + archivo "foto" opcional.
   */
  @Roles('ALUMNO')
  @Post()
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Reportar incidencia con foto (HU-AL-06)' })
  async crear(
    @Body()
    body: { equipoId: string; titulo: string; descripcion: string },
    @CurrentUser() user: AuthUser,
    @UploadedFile()
    file?: { originalname: string; buffer: Buffer; mimetype: string },
  ) {
    const fotoUrl = file ? await this.storage.saveIncidentPhoto(file) : undefined;
    return this.incidenciasService.crear(
      {
        equipoId: parseInt(body.equipoId, 10),
        titulo: body.titulo,
        descripcion: body.descripcion,
      },
      user.userId,
      fotoUrl,
    );
  }

  /** HU-AL-07: mis reportes (ALUMNO). */
  @Roles('ALUMNO')
  @Get('mis-reportes')
  @ApiOperation({ summary: 'Mis reportes de incidencias (HU-AL-07)' })
  misReportes(@CurrentUser() user: AuthUser) {
    return this.incidenciasService.findMisReportes(user.userId);
  }

  /** HU-ST-02, HU-AD-09: listado con filtros (SOPORTE, ADMIN). */
  @Roles('SOPORTE', 'ADMIN')
  @Get()
  @ApiOperation({ summary: 'Listar incidencias por estado (HU-ST-02, HU-AD-09)' })
  findAll(@Query() filters: FilterIncidenciasDto) {
    return this.incidenciasService.findAll(filters);
  }

  /** HU-ST-07: historial completo (SOPORTE, ADMIN). */
  @Roles('SOPORTE', 'ADMIN')
  @Get('historial')
  @ApiOperation({ summary: 'Historial de incidencias (HU-ST-07)' })
  historial(
    @Query('estado') estado?: EstadoIncidencia,
    @Query('tecnicoId') tecnicoId?: string,
  ) {
    return this.incidenciasService.findHistorial({
      estado:
        estado && EstadoIncidencia[estado as keyof typeof EstadoIncidencia]
          ? estado
          : undefined,
      tecnicoId: tecnicoId ? parseInt(tecnicoId, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de incidencia' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.incidenciasService.findOne(id);
  }

  /** HU-ST-04: tomar incidencia PENDIENTE (SOPORTE). */
  @Roles('SOPORTE')
  @Patch(':id/tomar')
  @ApiOperation({ summary: 'Tomar incidencia PENDIENTE (HU-ST-04)' })
  tomar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.incidenciasService.tomar(id, user.userId);
  }

  /** HU-ST-05: cambiar estado (SOPORTE). */
  @Roles('SOPORTE')
  @Patch(':id/estado')
  @ApiOperation({ summary: 'Cambiar estado (HU-ST-05)' })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoDto,
  ) {
    return this.incidenciasService.cambiarEstado(id, dto);
  }

  /** HU-ST-06: registrar solución → RESUELTA (SOPORTE). */
  @Roles('SOPORTE')
  @Patch(':id/solucion')
  @ApiOperation({ summary: 'Registrar solución y pasar a RESUELTA (HU-ST-06)' })
  registrarSolucion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarSolucionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.incidenciasService.registrarSolucion(id, dto, user.userId);
  }
}
