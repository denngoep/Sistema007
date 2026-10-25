import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { RequestPasswordRecoveryDto } from '../dto/request-password-recovery.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // REGISTRO DE USUARIOS
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // INICIO DE SESIÓN CON CORREO Y CONTRASEÑA
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // INICIO DE SESIÓN ALTERNATIVO CON GOOGLE
  @Post('google')
  async loginWithGoogle(
    @Body() googleLoginDto: GoogleLoginDto,
  ): Promise<Awaited<ReturnType<AuthService['loginWithGoogle']>>> {
    return await this.authService.loginWithGoogle(googleLoginDto);
  }

  // SOLICITAR CÓDIGO DE RECUPERACIÓN
  @Post('forgot-password')
  forgotPassword(@Body() dto: RequestPasswordRecoveryDto) {
    return this.authService.requestPasswordRecovery(dto);
  }

  // RESTABLECER CONTRASEÑA
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
