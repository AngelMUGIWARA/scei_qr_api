import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** HU-AL-01, HU-ST-01, HU-AD-01: login único (público). */
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login (ALUMNO / SOPORTE / ADMIN)' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  /** HU-GEN-02: logout (autenticado). */
  @ApiBearerAuth('jwt')
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cerrar sesión (HU-GEN-02)' })
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.userId);
  }
}
