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
    const existingUser = await this.authRepository.findByEmail(registerDto.email);

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

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
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
