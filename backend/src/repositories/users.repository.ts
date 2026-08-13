import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Busca un usuario por su correo electrónico
  findByEmail(correo: string) {
    return this.prisma.usuario.findUnique({
      where: {
        correo,
      },
    });
  }

  create(nombre: string, correo: string, password: string) {
    return this.prisma.usuario.create({
      data: {
        nombre,
        correo,
        password,
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        activo: true,
        createdAt: true,
      },
    });
  }
}
