import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  getUsers() {
    return {
      message: 'Módulo de usuarios de Sistema007 funcionando correctamente',
    };
  }

  async createUser(createUserDto: CreateUserDto) {
    // Verifica si el correo ya está registrado
    const existingUser = await this.prisma.usuario.findUnique({
      where: {
        correo: createUserDto.correo,
      },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya se encuentra registrado');
    }

    // Protege la contraseña antes de almacenarla
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Guarda el usuario en MySQL mediante Prisma
    const user = await this.prisma.usuario.create({
      data: {
        nombre: createUserDto.nombre,
        correo: createUserDto.correo,
        password: hashedPassword,
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        activo: true,
        createdAt: true,
      },
    });

    return {
      message: 'Usuario registrado correctamente',
      user,
    };
  }
}
