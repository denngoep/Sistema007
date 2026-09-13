/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMedication(
    nombre: string,
    concentracion: string,
    formaFarmaceutica: string,
  ) {
    return this.prisma.medicamento.findFirst({
      where: {
        nombre,
        concentracion,
        formaFarmaceutica,
      },
    });
  }

  createMedication(data: {
    nombre: string;
    concentracion: string;
    formaFarmaceutica: string;
    viaAdministracion?: string;
  }) {
    return this.prisma.medicamento.create({
      data,
    });
  }

  getLastProduct() {
    return this.prisma.productoInventario.findFirst({
      where: {
        codigoInterno: {
          not: null,
        },
      },
      orderBy: {
        codigoInterno: 'desc',
      },
      select: {
        codigoInterno: true,
      },
    });
  }

  findProductByCode(codigoInterno: number) {
    return this.prisma.productoInventario.findUnique({
      where: {
        codigoInterno,
      },
    });
  }

  createProduct(data: {
    medicamentoId?: number;
    codigoInterno: number;
    tipo: 'MEDICAMENTO' | 'INSUMO';
    descripcion: string;
    marca?: string;
    laboratorio?: string;
    registroInvima?: string;
    lote: {
      numeroLote: string;
      fechaVencimiento: Date;
      cantidad: number;
    };
  }) {
    return this.prisma.productoInventario.create({
      data: {
        medicamentoId: data.medicamentoId,
        codigoInterno: data.codigoInterno,
        tipo: data.tipo,
        descripcion: data.descripcion,
        marca: data.marca,
        laboratorio: data.laboratorio,
        registroInvima: data.registroInvima,

        lotes: {
          create: {
            numeroLote: data.lote.numeroLote,
            fechaVencimiento: data.lote.fechaVencimiento,
            cantidad: data.lote.cantidad,
          },
        },
      },

      include: {
        medicamento: true,
        lotes: true,
      },
    });
  }
}
