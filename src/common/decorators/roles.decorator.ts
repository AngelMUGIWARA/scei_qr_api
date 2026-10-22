import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restringe un endpoint a los roles indicados: @Roles('ADMIN') */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
