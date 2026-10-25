import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { randomInt } from 'node:crypto';

import { AuthRepository } from '../repositories/auth.repository';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { MailService } from './mail.service';
import { RequestPasswordRecoveryDto } from '../dto/request-password-recovery.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  // REGISTRO DE USUARIOS
  async register(registerDto: RegisterDto) {
    const existingUser = await this.authRepository.findByEmail(
      registerDto.email,
    );

    if (existingUser) {
      throw new ConflictException('El email ya se encuentra registrado');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    await this.authRepository.createUser({
      nombre: registerDto.nombre,
      correo: registerDto.email,
      password: hashedPassword,
    });

    return {
      success: true,
      message: 'Usuario registrado correctamente',
    };
  }

  // VERIFICACIÓN GOOGLE RECAPTCHA V2
  private async verifyCaptcha(captchaToken: string): Promise<void> {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      throw new InternalServerErrorException(
        'Google reCAPTCHA no está configurado',
      );
    }

    if (!captchaToken) {
      throw new UnauthorizedException(
        'Debes completar la verificación No soy un robot',
      );
    }

    const params = new URLSearchParams({
      secret: secretKey,
      response: captchaToken,
    });

    let result: { success?: boolean };

    try {
      const response = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        throw new Error('Error al consultar Google reCAPTCHA');
      }

      result = (await response.json()) as {
        success?: boolean;
      };
    } catch {
      throw new InternalServerErrorException(
        'No fue posible verificar el CAPTCHA. Intenta nuevamente.',
      );
    }

    if (result.success !== true) {
      throw new UnauthorizedException(
        'Verificación CAPTCHA inválida o expirada',
      );
    }
  }

  // INICIO DE SESIÓN CON JWT Y CAPTCHA
  async login(loginDto: LoginDto) {
    await this.verifyCaptcha(loginDto.captchaToken);

    const user = await this.authRepository.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (!user.activo) {
      throw new UnauthorizedException('Usuario bloqueado');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      const updatedUser = await this.authRepository.incrementFailedAttempts(
        user.id,
      );

      if (updatedUser.intentosFallidos >= 4) {
        await this.authRepository.blockUser(user.id);

        throw new UnauthorizedException(
          'Usuario bloqueado por superar el número máximo de intentos',
        );
      }

      throw new UnauthorizedException(
        `Credenciales incorrectas. Intento ${updatedUser.intentosFallidos} de 4`,
      );
    }

    if (user.intentosFallidos > 0) {
      await this.authRepository.resetFailedAttempts(user.id);
    }

    const payload = {
      sub: user.id,
      email: user.correo,
      nombre: user.nombre,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.correo,
        activo: user.activo,
      },
    };
  }

  // INICIO DE SESIÓN ALTERNATIVO CON GOOGLE
  async loginWithGoogle(googleLoginDto: GoogleLoginDto) {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      throw new InternalServerErrorException(
        'El inicio de sesión con Google no está configurado',
      );
    }

    const googleClient = new OAuth2Client(clientId);

    let googlePayload;

    try {
      // Verificar que la credencial provenga de Google
      // y corresponda a nuestro cliente OAuth.
      const ticket = await googleClient.verifyIdToken({
        idToken: googleLoginDto.credential,
        audience: clientId,
      });

      googlePayload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        'La autenticación con Google no es válida o ha expirado',
      );
    }

    // Google debe proporcionar un correo verificado.
    if (
      !googlePayload?.sub ||
      !googlePayload.email ||
      googlePayload.email_verified !== true
    ) {
      throw new UnauthorizedException(
        'No fue posible verificar tu cuenta de Google',
      );
    }

    const email = googlePayload.email.trim().toLowerCase();

    // Solo permitir usuarios registrados en Sistema007.
    const user = await this.authRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException(
        'Tu cuenta de Google no está registrada en Sistema007',
      );
    }

    // Respetar el bloqueo y el estado del usuario.
    if (!user.activo) {
      throw new UnauthorizedException('Tu usuario está bloqueado o inactivo');
    }

    // Generar el mismo tipo de JWT del login tradicional.
    const payload = {
      sub: user.id,
      email: user.correo,
      nombre: user.nombre,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      success: true,
      message: 'Inicio de sesión con Google exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.correo,
        activo: user.activo,
      },
    };
  }

  // SOLICITAR RECUPERACIÓN DE CONTRASEÑA
  async requestPasswordRecovery(dto: RequestPasswordRecoveryDto) {
    const response = {
      success: true,
      message:
        'Si el correo está registrado, recibirás un código de recuperación.',
    };

    const user = await this.authRepository.findByEmail(
      dto.email.trim().toLowerCase(),
    );

    if (!user) {
      return response;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentRequests =
      await this.authRepository.countRecentRecoveryRequests(
        user.id,
        oneHourAgo,
      );

    if (recentRequests >= 3) {
      return response;
    }

    const code = randomInt(100000, 1000000).toString();

    const codigoHash = await bcrypt.hash(code, 10);

    const fechaExpiracion = new Date(Date.now() + 10 * 60 * 1000);

    await this.authRepository.invalidatePreviousRecoveryCodes(user.id);

    const recovery = await this.authRepository.createPasswordRecovery({
      usuarioId: user.id,
      codigoHash,
      fechaExpiracion,
    });

    try {
      await this.mailService.sendRecoveryCode(user.correo, code);
    } catch {
      await this.authRepository.invalidateRecoveryCode(recovery.id);
    }

    return response;
  }

  // RESTABLECER CONTRASEÑA MEDIANTE CÓDIGO
  async resetPassword(dto: ResetPasswordDto) {
    const invalidCodeMessage =
      'Código incorrecto, expirado o sin intentos disponibles';

    const user = await this.authRepository.findByEmail(
      dto.email.trim().toLowerCase(),
    );

    if (!user) {
      throw new UnauthorizedException(invalidCodeMessage);
    }

    const recovery = await this.authRepository.findLatestPasswordRecovery(
      user.id,
    );

    if (!recovery || recovery.intentosFallidos >= 3) {
      throw new UnauthorizedException(invalidCodeMessage);
    }

    const isCodeValid = await bcrypt.compare(dto.codigo, recovery.codigoHash);

    if (!isCodeValid) {
      const updated = await this.authRepository.incrementRecoveryAttempts(
        recovery.id,
      );

      if (updated.intentosFallidos >= 3) {
        await this.authRepository.invalidateRecoveryCode(recovery.id);
      }

      throw new UnauthorizedException(invalidCodeMessage);
    }

    const hashedPassword = await bcrypt.hash(dto.nuevaPassword, 10);

    await this.authRepository.updatePasswordWithRecovery(
      user.id,
      recovery.id,
      hashedPassword,
    );

    return {
      success: true,
      message: 'Contraseña actualizada correctamente',
    };
  }
}
