import { Injectable } from '@nestjs/common';
import { Prisma, TipoMovimientoInventario } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type InventoryMovementFilters = {
  busqueda?: string;
  tipo?: TipoMovimientoInventario;
  sedeId?: number;
  bodegaId?: number;
  productoId?: number;
  loteId?: number;
  usuarioId?: number;
  fechaInicio?: Date;
  fechaFin?: Date;
};

export type InventoryStockFilters = {
  busqueda?: string;
  sedeId?: number;
  bodegaId?: number;
  productoId?: number;
  loteId?: number;
  soloConExistencia?: boolean;
};

@Injectable()
export class InventoryMovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildMovementWhere(
    filters: InventoryMovementFilters,
  ): Prisma.MovimientoInventarioWhereInput {
    const where: Prisma.MovimientoInventarioWhereInput = {};

    if (filters.tipo) {
      where.tipo = filters.tipo;
    }

    if (filters.loteId) {
      where.loteId = filters.loteId;
    }

    if (filters.usuarioId) {
      where.usuarioId = filters.usuarioId;
    }

    if (filters.productoId) {
      where.lote = {
        productoInventarioId: filters.productoId,
      };
    }

    if (filters.sedeId || filters.bodegaId) {
      const bodega: Prisma.BodegaWhereInput = {};

      if (filters.sedeId) {
        bodega.sedeId = filters.sedeId;
      }

      if (filters.bodegaId) {
        bodega.id = filters.bodegaId;
      }

      where.AND = [
        {
          OR: [
            { bodegaOrigen: { is: bodega } },
            { bodegaDestino: { is: bodega } },
          ],
        },
      ];
    }

    if (filters.fechaInicio || filters.fechaFin) {
      where.fechaMovimiento = {
        ...(filters.fechaInicio && {
          gte: filters.fechaInicio,
        }),
        ...(filters.fechaFin && {
          lte: filters.fechaFin,
        }),
      };
    }

    const busqueda = filters.busqueda?.trim();

    if (busqueda) {
      where.OR = [
        { referencia: { contains: busqueda } },
        { motivo: { contains: busqueda } },
        { usuario: { is: { nombre: { contains: busqueda } } } },
        {
          lote: {
            is: {
              numeroLote: { contains: busqueda },
            },
          },
        },
        {
          lote: {
            is: {
              productoInventario: {
                is: {
                  descripcion: { contains: busqueda },
                },
              },
            },
          },
        },
        {
          lote: {
            is: {
              productoInventario: {
                is: {
                  medicamento: {
                    is: {
                      nombre: { contains: busqueda },
                    },
                  },
                },
              },
            },
          },
        },
      ];

      const codigo = Number(busqueda);

      if (Number.isSafeInteger(codigo) && codigo > 0) {
        where.OR.push({
          lote: {
            is: {
              productoInventario: {
                is: { codigoInterno: codigo },
              },
            },
          },
        });
      }
    }

    return where;
  }

  private readonly movementInclude = {
    lote: {
      include: {
        productoInventario: {
          include: {
            medicamento: true,
          },
        },
      },
    },
    usuario: {
      select: {
        id: true,
        nombre: true,
        rol: true,
      },
    },
    bodegaOrigen: {
      include: {
        sede: true,
      },
    },
    bodegaDestino: {
      include: {
        sede: true,
      },
    },
    ingresoInventario: {
      select: {
        id: true,
        numeroIngreso: true,
      },
    },
    dispensacion: {
      select: {
        id: true,
        numeroDispensacion: true,
      },
    },
  } satisfies Prisma.MovimientoInventarioInclude;

  async findMovements(
    filters: InventoryMovementFilters,
    pagina = 1,
    limite = 25,
  ) {
    const where = this.buildMovementWhere(filters);

    const [total, movimientos] = await this.prisma.$transaction([
      this.prisma.movimientoInventario.count({ where }),
      this.prisma.movimientoInventario.findMany({
        where,
        include: this.movementInclude,
        orderBy: [{ fechaMovimiento: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
      movimientos,
    };
  }

  async findMovementsForExport(filters: InventoryMovementFilters) {
    return this.prisma.movimientoInventario.findMany({
      where: this.buildMovementWhere(filters),
      include: this.movementInclude,
      orderBy: [{ fechaMovimiento: 'desc' }, { id: 'desc' }],
    });
  }

  private buildStockWhere(
    filters: InventoryStockFilters,
  ): Prisma.ExistenciaInventarioWhereInput {
    const where: Prisma.ExistenciaInventarioWhereInput = {};

    if (filters.sedeId) {
      where.bodega = {
        is: { sedeId: filters.sedeId },
      };
    }

    if (filters.bodegaId) {
      where.bodegaId = filters.bodegaId;
    }

    if (filters.loteId) {
      where.loteId = filters.loteId;
    }

    if (filters.productoId) {
      where.lote = {
        is: {
          productoInventarioId: filters.productoId,
        },
      };
    }

    if (filters.soloConExistencia) {
      where.cantidad = { gt: 0 };
    }

    const busqueda = filters.busqueda?.trim();

    if (busqueda) {
      const condiciones: Prisma.ExistenciaInventarioWhereInput[] = [
        {
          lote: {
            is: {
              numeroLote: { contains: busqueda },
            },
          },
        },
        {
          lote: {
            is: {
              productoInventario: {
                is: {
                  descripcion: { contains: busqueda },
                },
              },
            },
          },
        },
        {
          lote: {
            is: {
              productoInventario: {
                is: {
                  medicamento: {
                    is: {
                      nombre: { contains: busqueda },
                    },
                  },
                },
              },
            },
          },
        },
      ];

      const codigo = Number(busqueda);

      if (Number.isSafeInteger(codigo) && codigo > 0) {
        condiciones.push({
          lote: {
            is: {
              productoInventario: {
                is: { codigoInterno: codigo },
              },
            },
          },
        });
      }

      where.OR = condiciones;
    }

    return where;
  }

  private readonly stockInclude = {
    lote: {
      include: {
        productoInventario: {
          include: {
            medicamento: true,
          },
        },
      },
    },
    bodega: {
      include: {
        sede: true,
      },
    },
  } satisfies Prisma.ExistenciaInventarioInclude;

  async findStockReport(
    filters: InventoryStockFilters,
    pagina = 1,
    limite = 25,
  ) {
    const where = this.buildStockWhere(filters);

    const [total, existencias] = await this.prisma.$transaction([
      this.prisma.existenciaInventario.count({ where }),
      this.prisma.existenciaInventario.findMany({
        where,
        include: this.stockInclude,
        orderBy: { id: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
      existencias,
    };
  }

  async findStockForExport(filters: InventoryStockFilters) {
    return this.prisma.existenciaInventario.findMany({
      where: this.buildStockWhere(filters),
      include: this.stockInclude,
      orderBy: { id: 'asc' },
    });
  }
}
