import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Rol } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUsuarioDto, UpdateUsuarioDto } from './dto/usuario.dto';

const USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  rol: true,
  activo: true,
  createdAt: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** HU-AD-03, HU-AD-12: listado con filtros opcionales. */
  findAll(params?: { rol?: Rol; activo?: boolean; q?: string }) {
    return this.prisma.usuario.findMany({
      where: {
        rol: params?.rol,
        activo: params?.activo,
        ...(params?.q
          ? {
              OR: [
                { username: { contains: params.q, mode: 'insensitive' } },
                { fullName: { contains: params.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: USER_SELECT,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  /** HU-AD-02: crear usuario (hash de contraseña incluido). */
  async create(dto: CreateUsuarioDto) {
    const exists = await this.prisma.usuario.findUnique({
      where: { username: dto.username },
    });
    if (exists) {
      throw new ConflictException(`El usuario "${dto.username}" ya existe`);
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.usuario.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        rol: dto.rol,
        activo: dto.activo ?? true,
      },
      select: USER_SELECT,
    });
    return user;
  }

  /** HU-AD-03/12: editar usuario (password opcional). */
  async update(id: number, dto: UpdateUsuarioDto) {
    await this.findOne(id);
    const { password, ...rest } = dto;
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
    return this.prisma.usuario.update({
      where: { id },
      data: { ...rest, ...(passwordHash ? { passwordHash } : {}) },
      select: USER_SELECT,
    });
  }
}
