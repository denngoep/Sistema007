import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(correo: string) {
    return this.prisma.usuario.findUnique({
      where: {
        correo,
      },
    });
  }

  findAll() {
    return this.prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        correo: true,
        activo: true,
        intentosFallidos: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        id: 'asc',
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
