import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateAuthUserParams = {
  nombre: string;
  correo: string;
  password: string;
};

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Busca un usuario por su correo
  findByEmail(correo: string) {
    return this.prisma.usuario.findUnique({
      where: {
        correo,
      },
    });
  }

  // Crea un nuevo usuario
  createUser(data: CreateAuthUserParams) {
    return this.prisma.usuario.create({
      data,
      select: {
        id: true,
        nombre: true,
        correo: true,
        activo: true,
        createdAt: true,
      },
    });
  }

  // Suma un intento fallido al usuario
  incrementFailedAttempts(id: number) {
    return this.prisma.usuario.update({
      where: {
        id,
      },
      data: {
        intentosFallidos: {
          increment: 1,
        },
      },
    });
  }

  // Reinicia los intentos fallidos después de un login correcto
  resetFailedAttempts(id: number) {
    return this.prisma.usuario.update({
      where: {
        id,
      },
      data: {
        intentosFallidos: 0,
      },
    });
  }

  // Bloquea al usuario
  blockUser(id: number) {
    return this.prisma.usuario.update({
      where: {
        id,
      },
      data: {
        activo: false,
      },
    });
  }
}
