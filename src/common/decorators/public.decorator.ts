import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint como público (sin JWT).
 * Se combina con el JwtAuthGuard global.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
