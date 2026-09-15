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

  findAllProducts() {
    return this.prisma.productoInventario.findMany({
      orderBy: {
        codigoInterno: 'asc',
      },
      include: {
        medicamento: true,
        lotes: {
          orderBy: {
            fechaVencimiento: 'asc',
          },
          include: {
            existencias: {
              include: {
                bodega: {
                  include: {
                    sede: true,
                  },
                },
              },
            },
          },
        },
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

  findBatchById(loteId: number) {
    return this.prisma.loteInventario.findUnique({
      where: {
        id: loteId,
      },
    });
  }

  findWarehouseById(bodegaId: number) {
    return this.prisma.bodega.findUnique({
      where: {
        id: bodegaId,
      },
      include: {
        sede: true,
      },
    });
  }

  findSiteById(sedeId: number) {
    return this.prisma.sede.findUnique({
      where: {
        id: sedeId,
      },
    });
  }

  findWarehouseByNameInSite(sedeId: number, nombre: string) {
    return this.prisma.bodega.findFirst({
      where: {
        sedeId,
        nombre,
      },
    });
  }

  createWarehouse(data: {
    sedeId: number;
    nombre: string;
    descripcion?: string;
    permiteDispensacion: boolean;
  }) {
    return this.prisma.bodega.create({
      data: {
        sedeId: data.sedeId,
        nombre: data.nombre,
        descripcion: data.descripcion,
        permiteDispensacion: data.permiteDispensacion,
        activa: true,
      },
      include: {
        sede: true,
      },
    });
  }

  findStock(loteId: number, bodegaId: number) {
    return this.prisma.existenciaInventario.findUnique({
      where: {
        loteId_bodegaId: {
          loteId,
          bodegaId,
        },
      },
    });
  }

  async transferStock(data: {
    loteId: number;
    bodegaOrigenId: number;
    bodegaDestinoId: number;
    cantidad: number;
    usuarioId: number;
    motivo: string;
    referencia?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existenciaOrigen = await tx.existenciaInventario.findUnique({
        where: {
          loteId_bodegaId: {
            loteId: data.loteId,
            bodegaId: data.bodegaOrigenId,
          },
        },
      });

      if (!existenciaOrigen) {
        throw new Error('EXISTENCIA_ORIGEN_NO_ENCONTRADA');
      }

      if (existenciaOrigen.cantidad < data.cantidad) {
        throw new Error('STOCK_INSUFICIENTE');
      }

      const origen = await tx.existenciaInventario.update({
        where: {
          loteId_bodegaId: {
            loteId: data.loteId,
            bodegaId: data.bodegaOrigenId,
          },
        },
        data: {
          cantidad: {
            decrement: data.cantidad,
          },
        },
      });

      const destino = await tx.existenciaInventario.upsert({
        where: {
          loteId_bodegaId: {
            loteId: data.loteId,
            bodegaId: data.bodegaDestinoId,
          },
        },
        update: {
          cantidad: {
            increment: data.cantidad,
          },
        },
        create: {
          loteId: data.loteId,
          bodegaId: data.bodegaDestinoId,
          cantidad: data.cantidad,
        },
      });

      const movimiento = await tx.movimientoInventario.create({
        data: {
          loteId: data.loteId,
          tipo: 'TRASLADO',
          cantidad: data.cantidad,
          bodegaOrigenId: data.bodegaOrigenId,
          bodegaDestinoId: data.bodegaDestinoId,
          usuarioId: data.usuarioId,
          motivo: data.motivo,
          referencia: data.referencia,
        },
      });

      return {
        origen,
        destino,
        movimiento,
      };
    });
  }

  async adjustStock(data: {
    loteId: number;
    bodegaId: number;
    tipo: 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA';
    cantidad: number;
    usuarioId: number;
    motivo: string;
    referencia?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existencia = await tx.existenciaInventario.findUnique({
        where: {
          loteId_bodegaId: {
            loteId: data.loteId,
            bodegaId: data.bodegaId,
          },
        },
      });

      if (data.tipo === 'AJUSTE_SALIDA') {
        if (!existencia) {
          throw new Error('EXISTENCIA_NO_ENCONTRADA');
        }

        if (existencia.cantidad < data.cantidad) {
          throw new Error('STOCK_INSUFICIENTE');
        }
      }

      const existenciaActualizada = await tx.existenciaInventario.upsert({
        where: {
          loteId_bodegaId: {
            loteId: data.loteId,
            bodegaId: data.bodegaId,
          },
        },
        update: {
          cantidad:
            data.tipo === 'AJUSTE_ENTRADA'
              ? { increment: data.cantidad }
              : { decrement: data.cantidad },
        },
        create: {
          loteId: data.loteId,
          bodegaId: data.bodegaId,
          cantidad: data.tipo === 'AJUSTE_ENTRADA' ? data.cantidad : 0,
        },
      });

      const movimiento = await tx.movimientoInventario.create({
        data: {
          loteId: data.loteId,
          tipo: data.tipo,
          cantidad: data.cantidad,
          bodegaOrigenId:
            data.tipo === 'AJUSTE_SALIDA' ? data.bodegaId : undefined,
          bodegaDestinoId:
            data.tipo === 'AJUSTE_ENTRADA' ? data.bodegaId : undefined,
          usuarioId: data.usuarioId,
          motivo: data.motivo,
          referencia: data.referencia,
        },
      });

      return {
        existencia: existenciaActualizada,
        movimiento,
      };
    });
  }
}
