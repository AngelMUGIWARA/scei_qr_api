import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto, UpdateUsuarioDto } from './dto/usuario.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('usuarios')
@ApiBearerAuth('jwt')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  /** HU-AD-03, HU-AD-12: listar usuarios (solo ADMIN). */
  @Roles('ADMIN')
  @Get()
  @ApiOperation({ summary: 'Listar usuarios (HU-AD-03, HU-AD-12)' })
  findAll(
    @Query('rol') rol?: Rol,
    @Query('activo') activo?: string,
    @Query('q') q?: string,
  ) {
    return this.usuariosService.findAll({
      rol: rol && Rol[rol as keyof typeof Rol] ? rol : undefined,
      activo: activo === undefined ? undefined : activo === 'true',
      q: q || undefined,
    });
  }

  /** HU-AD-02: crear usuario (solo ADMIN). */
  @Roles('ADMIN')
  @Post()
  @ApiOperation({ summary: 'Crear usuario (HU-AD-02)' })
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }

  @Roles('ADMIN')
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de usuario' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  /** HU-AD-03/12: editar usuario (solo ADMIN). */
  @Roles('ADMIN')
  @Patch(':id')
  @ApiOperation({ summary: 'Editar usuario (HU-AD-03, HU-AD-12)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, dto);
  }
}
