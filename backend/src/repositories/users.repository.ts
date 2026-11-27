import type { Prisma } from '../generated/prisma/client';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '../generated/prisma/enums';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(work, { isolationLevel: 'Serializable' });
  }

  findActor(id: number, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).usuario.findUnique({
      where: { id },
      select: {
        id: true,
        activo: true,
        rol: true,
        servicioId: true,
        esCoordinador: true,
        servicio: {
          select: { id: true, codigo: true, nombre: true, activo: true },
        },
      },
    });
  }

  findService(id: number, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).servicio.findUnique({ where: { id } });
  }

  listServices(tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).servicio.findMany({
      where: { activo: true },
      orderBy: { codigo: 'asc' },
    });
  }

  countActiveAdministrators(tx: Prisma.TransactionClient) {
    return tx.usuario.count({ where: { activo: true, rol: 'ADMINISTRADOR' } });
  }

  findByEmail(correo: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).usuario.findUnique({
      where: {
        correo,
      },
    });
  }

  findAll(where: Prisma.UsuarioWhereInput = {}, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).usuario.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        correo: true,
        rol: true,
        servicioId: true,
        esCoordinador: true,
        servicio: {
          select: { id: true, codigo: true, nombre: true, activo: true },
        },
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

  findPage(
    where: Prisma.UsuarioWhereInput,
    page: number,
    limit: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    return Promise.all([
      client.usuario.count({ where }),
      client.usuario.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          correo: true,
          rol: true,
          servicioId: true,
          esCoordinador: true,
          servicio: {
            select: { id: true, codigo: true, nombre: true, activo: true },
          },
          activo: true,
          intentosFallidos: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  }

  update(
    id: number,
    data: {
      nombre?: string;
      correo?: string;
      password?: string;
      rol?: RolUsuario;
      servicioId?: number | null;
      esCoordinador?: boolean;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).usuario.update({
      where: {
        id,
      },
      data,
      select: {
        id: true,
        nombre: true,
        correo: true,
        rol: true,
        servicioId: true,
        esCoordinador: true,
        servicio: {
          select: { id: true, codigo: true, nombre: true, activo: true },
        },
        activo: true,
        intentosFallidos: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  updateStatus(id: number, activo: boolean, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).usuario.update({
      where: {
        id,
      },
      data: {
        activo,
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        rol: true,
        servicioId: true,
        esCoordinador: true,
        servicio: {
          select: { id: true, codigo: true, nombre: true, activo: true },
        },
        activo: true,
        intentosFallidos: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  create(
    nombre: string,
    correo: string,
    password: string,
    rol: RolUsuario,
    servicioId?: number,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).usuario.create({
      data: {
        nombre,
        correo,
        password,
        rol,
        servicioId,
        esCoordinador: false,
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        rol: true,
        servicioId: true,
        esCoordinador: true,
        servicio: {
          select: { id: true, codigo: true, nombre: true, activo: true },
        },
        activo: true,
        createdAt: true,
      },
    });
  }
}
