import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class PatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private handleWriteError(error: unknown): never {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined;
    if (code === 'P2002') {
      throw new ConflictException(
        'El número de documento ya se encuentra registrado',
      );
    }
    if (code === 'P2025') {
      throw new NotFoundException('Paciente no encontrado');
    }
    throw error;
  }

  findByDocument(numeroDocumento: string) {
    return this.prisma.paciente.findUnique({
      where: {
        numeroDocumento,
      },
    });
  }

  findAll() {
    return this.prisma.paciente.findMany({
      select: {
        id: true,
        tipoDocumento: true,
        numeroDocumento: true,
        nombres: true,
        apellidos: true,
        fechaNacimiento: true,
        telefono: true,
        correo: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  findPage(where: Prisma.PacienteWhereInput, page: number, limit: number) {
    const select = {
      id: true,
      tipoDocumento: true,
      numeroDocumento: true,
      nombres: true,
      apellidos: true,
      fechaNacimiento: true,
      telefono: true,
      correo: true,
      activo: true,
      createdAt: true,
      updatedAt: true,
    };
    return Promise.all([
      this.prisma.paciente.count({ where }),
      this.prisma.paciente.findMany({
        where,
        select,
        orderBy: [{ id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  }

  update(
    id: number,
    data: {
      tipoDocumento?: string;
      numeroDocumento?: string;
      nombres?: string;
      apellidos?: string;
      fechaNacimiento?: Date;
      telefono?: string;
      correo?: string;
    },
  ) {
    return this.prisma.paciente
      .update({
        where: {
          id,
        },
        data,
        select: {
          id: true,
          tipoDocumento: true,
          numeroDocumento: true,
          nombres: true,
          apellidos: true,
          fechaNacimiento: true,
          telefono: true,
          correo: true,
          activo: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .catch((error: unknown) => this.handleWriteError(error));
  }

  create(data: {
    tipoDocumento: string;
    numeroDocumento: string;
    nombres: string;
    apellidos: string;
    fechaNacimiento: Date;
    telefono?: string;
    correo?: string;
  }) {
    return this.prisma.paciente
      .create({
        data: {
          ...data,
          // Prisma executes this nested write atomically; neither record survives alone.
          historiaClinica: { create: {} },
        },
        select: {
          id: true,
          tipoDocumento: true,
          numeroDocumento: true,
          nombres: true,
          apellidos: true,
          fechaNacimiento: true,
          telefono: true,
          correo: true,
          activo: true,
          createdAt: true,
        },
      })
      .catch((error: unknown) => this.handleWriteError(error));
  }
}
