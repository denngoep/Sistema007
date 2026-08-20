import {
  ConflictException,
  Injectable,
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

  async login(loginDto: LoginDto) {
    const user = await this.authRepository.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Verifica si la cuenta ya se encuentra bloqueada.
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

    // Si inicia sesión correctamente, vuelve el contador a cero.
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
}
