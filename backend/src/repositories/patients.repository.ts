import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.paciente.update({
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
    });
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
    return this.prisma.paciente.create({
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
      },
    });
  }
}
