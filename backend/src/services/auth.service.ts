import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from '../repositories/auth.repository';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
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
    // Primero valida el CAPTCHA con Google.
    await this.verifyCaptcha(loginDto.captchaToken);

    const user = await this.authRepository.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Verifica si la cuenta está bloqueada.
    if (!user.activo) {
      throw new UnauthorizedException('Usuario bloqueado');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    // Si la contraseña es incorrecta, aumenta el contador.
    if (!isPasswordValid) {
      const updatedUser = await this.authRepository.incrementFailedAttempts(
        user.id,
      );

      // Al llegar a 4 intentos fallidos, bloquea la cuenta.
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

    // Si inicia sesión correctamente, reinicia el contador.
    if (user.intentosFallidos > 0) {
      await this.authRepository.resetFailedAttempts(user.id);
    }

    // Generación del token JWT.
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
}
