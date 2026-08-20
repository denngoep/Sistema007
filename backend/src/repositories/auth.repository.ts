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

  findByEmail(correo: string) {
    return this.prisma.usuario.findUnique({
      where: {
        correo,
      },
    });
  }

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
}
