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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsosService } from './usos.service';
import { IniciarUsoDto } from './dto/iniciar-uso.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('usos')
@ApiBearerAuth('jwt')
@Controller('usos')
export class UsosController {
  constructor(private readonly usosService: UsosService) {}

  /** HU-AL-03: iniciar uso con el QR escaneado (ALUMNO). */
  @Roles('ALUMNO')
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar uso escaneando QR (HU-AL-03)' })
  iniciar(@Body() dto: IniciarUsoDto, @CurrentUser() user: AuthUser) {
    return this.usosService.iniciar(dto, user.userId);
  }

  /** HU-AL-04: finalizar uso (ALUMNO). */
  @Roles('ALUMNO')
  @Patch(':id/finalizar')
  @ApiOperation({ summary: 'Finalizar uso (HU-AL-04)' })
  finalizar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.usosService.finalizar(id, user.userId);
  }

  /** HU-AL-05: mis registros de uso (ALUMNO). */
  @Roles('ALUMNO')
  @Get('mis-registros')
  @ApiOperation({ summary: 'Mis registros de uso (HU-AL-05)' })
  misRegistros(@CurrentUser() user: AuthUser) {
    return this.usosService.findMisRegistros(user.userId);
  }

  /** HU-AD-08: historial por equipo (ADMIN). */
  @Roles('ADMIN')
  @Get('historial')
  @ApiOperation({ summary: 'Historial de usos por equipo (HU-AD-08)' })
  historial(
    @Query('equipoId', ParseIntPipe) equipoId: number,
    @Query('alumnoId') alumnoId?: string,
  ) {
    return this.usosService.findHistorial(
      equipoId,
      alumnoId ? parseInt(alumnoId, 10) : undefined,
    );
  }
}
