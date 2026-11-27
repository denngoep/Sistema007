import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EstadoVerificacionInvima,
  ResultadoVerificacionIngreso,
  TipoProductoInventario,
  TipoBodega,
  CondicionConservacion,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryDocumentsService } from '../inventory/inventory-documents.service';

type ReceiptProduct = {
  productoId: number;
  numeroLote: string;
  fechaVencimiento: Date;
  cantidad: number;
  costoUnitario?: number;
  estadoVerificacionInvima: EstadoVerificacionInvima;
  temperaturaRegistrada?: number;
  humedadRegistrada?: number;
  resultadoVerificacion: ResultadoVerificacionIngreso;
  observacionesVerificacion?: string;
};

type ReceiptInput = {
  numeroFactura: string;
  fechaFactura: Date;
  proveedorId: number;
  bodegaDestinoId: number;
  usuarioId: number;
  observaciones?: string;
  productos: ReceiptProduct[];
};

type ReviewInput = {
  actaId: number;
  usuarioId: number;
  observaciones?: string;
  productos: {
    detalleActaId: number;
    resultadoVerificacion: ResultadoVerificacionIngreso;
    estadoVerificacionInvima: EstadoVerificacionInvima;
    temperaturaRegistrada?: number;
    humedadRegistrada?: number;
    observaciones?: string;
  }[];
};

@Injectable()
export class InventoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryDocuments: InventoryDocumentsService,
  ) {}

  findActiveSuppliers() {
    return this.prisma.proveedor.findMany({
      where: { activo: true },
      select: {
        id: true,
        nit: true,
        razonSocial: true,
        nombreComercial: true,
      },
      orderBy: { razonSocial: 'asc' },
    });
  }

  findSupplierByNit(nit: string) {
    return this.prisma.proveedor.findUnique({ where: { nit } });
  }

  createSupplier(data: {
    nit: string;
    razonSocial: string;
    nombreComercial?: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
    contacto?: string;
  }) {
    return this.prisma.proveedor.create({
      data: { ...data, activo: true },
    });
  }

  findActiveWarehouses() {
    return this.prisma.bodega.findMany({
      where: { activa: true, sede: { activa: true } },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        permiteDispensacion: true,
        sede: {
          select: {
            id: true,
            nombre: true,
            ciudad: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  findWarehousesForAdministration() {
    return this.prisma.bodega.findMany({
      select: {
        id: true,
        codigo: true,
        nombre: true,
        tipo: true,
        descripcion: true,
        permiteDispensacion: true,
        activa: true,
        sede: { select: { id: true, nombre: true, ciudad: true } },
        creadoPor: { select: { id: true, nombre: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ sede: { nombre: 'asc' } }, { nombre: 'asc' }],
    });
  }

  findActiveSites() {
    return this.prisma.sede.findMany({
      where: { activa: true },
      select: { id: true, codigo: true, nombre: true, ciudad: true },
      orderBy: { nombre: 'asc' },
    });
  }

  findMedication(
    nombre: string,
    concentracion: string,
    formaFarmaceutica: string,
  ) {
    return this.prisma.medicamento.findFirst({
      where: { nombre, concentracion, formaFarmaceutica },
    });
  }

  createMedication(data: {
    nombre: string;
    concentracion: string;
    formaFarmaceutica: string;
    viaAdministracion?: string;
  }) {
    return this.prisma.medicamento.create({ data });
  }

  getLastProduct() {
    return this.prisma.productoInventario.findFirst({
      where: { codigoInterno: { not: null } },
      orderBy: { codigoInterno: 'desc' },
      select: { codigoInterno: true },
    });
  }

  findProductByCode(codigoInterno: number) {
    return this.prisma.productoInventario.findUnique({
      where: { codigoInterno },
    });
  }

  findAllProducts() {
    return this.prisma.productoInventario.findMany({
      orderBy: { codigoInterno: 'asc' },
      include: {
        medicamento: true,
        lotes: {
          orderBy: { fechaVencimiento: 'asc' },
          include: {
            existencias: {
              include: { bodega: { include: { sede: true } } },
            },
          },
        },
      },
    });
  }

  createProduct(data: {
    medicamentoId?: number;
    codigoInterno: number;
    tipo: TipoProductoInventario;
    descripcion: string;
    marca?: string;
    laboratorio?: string;
    registroInvima?: string;
    condicionConservacion?: CondicionConservacion;
    temperaturaMinima?: number;
    temperaturaMaxima?: number;
    humedadMaxima?: number;
    claseRiesgo?: string;
  }) {
    return this.prisma.productoInventario.create({
      data: {
        ...data,
        condicionConservacion: data.condicionConservacion ?? 'AMBIENTE',
      },
      include: { medicamento: true, lotes: true },
    });
  }

  findBatchById(loteId: number) {
    return this.prisma.loteInventario.findUnique({ where: { id: loteId } });
  }

  findWarehouseById(bodegaId: number) {
    return this.prisma.bodega.findUnique({
      where: { id: bodegaId },
      include: { sede: true },
    });
  }

  findSiteById(sedeId: number) {
    return this.prisma.sede.findUnique({ where: { id: sedeId } });
  }

  findWarehouseByNameInSite(sedeId: number, nombre: string) {
    return this.prisma.bodega.findFirst({ where: { sedeId, nombre } });
  }

  findWarehouseByCode(codigo: string) {
    return this.prisma.bodega.findUnique({ where: { codigo } });
  }

  createWarehouse(data: {
    sedeId: number;
    codigo: string;
    nombre: string;
    tipo: TipoBodega;
    descripcion?: string;
    permiteDispensacion: boolean;
    creadoPorId: number;
  }) {
    return this.prisma.bodega.create({
      data: { ...data, activa: true },
      include: { sede: true },
    });
  }

  updateWarehouse(
    id: number,
    data: {
      codigo?: string;
      nombre?: string;
      descripcion?: string | null;
      tipo?: TipoBodega;
      permiteDispensacion?: boolean;
      activa?: boolean;
    },
  ) {
    return this.prisma.bodega.update({
      where: { id },
      data,
      include: { sede: true },
    });
  }

  findStock(loteId: number, bodegaId: number) {
    return this.prisma.existenciaInventario.findUnique({
      where: { loteId_bodegaId: { loteId, bodegaId } },
    });
  }

  findBatchesByExpiration(fechaLimite: Date) {
    return this.prisma.loteInventario.findMany({
      where: { fechaVencimiento: { lte: fechaLimite } },
      orderBy: { fechaVencimiento: 'asc' },
      include: {
        existencias: {
          where: { cantidad: { gt: 0 } },
          include: { bodega: { include: { sede: true } } },
        },
      },
    });
  }

  private readonly receiptInclude = {
    proveedor: { select: { id: true, razonSocial: true } },
    sede: true,
    elaboradoPor: { select: { id: true, nombre: true } },
    revisadoPor: { select: { id: true, nombre: true } },
    ingresoInventario: {
      include: { bodegaDestino: { select: { id: true, nombre: true } } },
    },
    detalles: {
      include: {
        producto: { include: { medicamento: true } },
        detalleIngreso: {
          include: { lote: { include: { existencias: true } } },
        },
        gestionNoConforme: {
          include: {
            bodega: {
              select: { id: true, nombre: true, permiteDispensacion: true },
            },
            responsable: { select: { id: true, nombre: true } },
          },
        },
        reevaluacionesTecnicas: {
          orderBy: { fechaReevaluacion: 'desc' as const },
        },
        correcciones: {
          orderBy: { fechaCorreccion: 'desc' as const },
          include: {
            documentos: {
              include: {
                documentoInventario: {
                  select: {
                    id: true,
                    mime: true,
                    tamano: true,
                    creadoAt: true,
                    sha256: true,
                  },
                },
                registradoPor: { select: { nombre: true } },
              },
              orderBy: { version: 'desc' as const },
            },
          },
        },
      },
      orderBy: { id: 'asc' as const },
    },
  };

  findAllReceipts() {
    return this.prisma.actaRecepcion.findMany({
      orderBy: { fechaRecepcion: 'desc' },
      include: this.receiptInclude,
    });
  }

  findReceiptById(actaId: number) {
    return this.prisma.actaRecepcion.findUnique({
      where: { id: actaId },
      include: this.receiptInclude,
    });
  }

  updateReceipt(
    actaId: number,
    data: {
      numeroFactura?: string;
      fechaFactura?: Date;
      numeroOrdenCompra?: string;
      numeroRemision?: string;
      observaciones?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const acta = await tx.actaRecepcion.findUnique({ where: { id: actaId } });
      if (!acta) throw new NotFoundException('La recepción no existe');

      if (acta.estado === 'ANULADA') {
        throw new BadRequestException(
          'No se puede modificar una recepción anulada',
        );
      }

      if (data.fechaFactura && Number.isNaN(data.fechaFactura.getTime())) {
        throw new BadRequestException('La fecha de factura no es válida');
      }

      if (data.numeroFactura && data.numeroFactura !== acta.numeroFactura) {
        const duplicada = await tx.actaRecepcion.findFirst({
          where: {
            proveedorId: acta.proveedorId,
            numeroFactura: data.numeroFactura,
            estado: { not: 'ANULADA' },
            id: { not: actaId },
          },
        });

        if (duplicada) {
          throw new ConflictException('La factura ya está registrada');
        }
      }

      return tx.actaRecepcion.update({
        where: { id: actaId },
        data,
        include: this.receiptInclude,
      });
    });
  }

  private validateTechnicalResult(item: {
    tipo: TipoProductoInventario;
    numeroLote: string;
    fechaVencimiento: Date;
    resultado: ResultadoVerificacionIngreso;
    invima: EstadoVerificacionInvima;
    temperatura?: number | null;
    humedad?: number | null;
    temperaturaMinima?: number | null;
    temperaturaMaxima?: number | null;
    humedadMaxima?: number | null;
    condicionConservacion?: CondicionConservacion;
  }) {
    if (item.resultado !== 'CONFORME') return;

    if (item.invima === 'PENDIENTE' || item.invima === 'NO_VIGENTE') {
      throw new BadRequestException(
        `El lote ${item.numeroLote} no tiene verificación INVIMA válida`,
      );
    }

    if (item.tipo === 'MEDICAMENTO' && item.invima === 'NO_APLICA') {
      throw new BadRequestException(
        `El medicamento del lote ${item.numeroLote} requiere verificación INVIMA`,
      );
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const vence = new Date(item.fechaVencimiento);
    vence.setHours(0, 0, 0, 0);

    if (vence < hoy) {
      throw new BadRequestException(`El lote ${item.numeroLote} está vencido`);
    }

    if (item.temperatura != null && !Number.isFinite(item.temperatura)) {
      throw new BadRequestException('Temperatura inválida');
    }

    if (
      item.humedad != null &&
      (!Number.isFinite(item.humedad) || item.humedad < 0 || item.humedad > 100)
    ) {
      throw new BadRequestException('Humedad inválida');
    }

    if (
      item.temperaturaMinima != null &&
      item.temperatura != null &&
      item.temperatura < item.temperaturaMinima
    ) {
      throw new BadRequestException(
        `Temperatura inferior al mínimo del lote ${item.numeroLote}`,
      );
    }

    if (
      item.temperaturaMaxima != null &&
      item.temperatura != null &&
      item.temperatura > item.temperaturaMaxima
    ) {
      throw new BadRequestException(
        `Temperatura superior al máximo del lote ${item.numeroLote}`,
      );
    }

    if (
      item.humedadMaxima != null &&
      item.humedad != null &&
      item.humedad > item.humedadMaxima
    ) {
      throw new BadRequestException(
        `Humedad superior al máximo del lote ${item.numeroLote}`,
      );
    }

    if (
      item.condicionConservacion === 'CADENA_FRIO' &&
      item.temperatura == null
    ) {
      throw new BadRequestException(
        `Registra la temperatura del lote ${item.numeroLote}`,
      );
    }
  }

  private async addConformingStock(
    tx: Prisma.TransactionClient,
    data: {
      actaId: number;
      detalleId: number;
      productoId: number;
      numeroLote: string;
      fechaVencimiento: Date;
      cantidad: number;
      costoUnitario?: number;
      bodegaId: number;
      usuarioId: number;
      numeroFactura: string;
      observaciones?: string;
    },
  ) {
    const acta = await tx.actaRecepcion.findUniqueOrThrow({
      where: { id: data.actaId },
    });

    let ingreso = await tx.ingresoInventario.findUnique({
      where: { actaRecepcionId: data.actaId },
    });

    if (!ingreso) {
      ingreso = await tx.ingresoInventario.create({
        data: {
          numeroIngreso: `ING-${randomUUID()}`,
          actaRecepcionId: data.actaId,
          bodegaDestinoId: data.bodegaId,
          confirmadoPorId: data.usuarioId,
          estado: 'CONFIRMADO',
          observaciones: data.observaciones,
        },
      });
    }

    const existente = await tx.loteInventario.findUnique({
      where: {
        productoInventarioId_numeroLote: {
          productoInventarioId: data.productoId,
          numeroLote: data.numeroLote,
        },
      },
    });

    if (
      existente &&
      existente.fechaVencimiento.getTime() !== data.fechaVencimiento.getTime()
    ) {
      throw new ConflictException(
        `El lote ${data.numeroLote} tiene otra fecha de vencimiento`,
      );
    }

    if (existente && existente.estado !== 'DISPONIBLE') {
      throw new BadRequestException(
        `El lote ${data.numeroLote} no está disponible`,
      );
    }

    const lote = await tx.loteInventario.upsert({
      where: {
        productoInventarioId_numeroLote: {
          productoInventarioId: data.productoId,
          numeroLote: data.numeroLote,
        },
      },
      update: {},
      create: {
        productoInventarioId: data.productoId,
        numeroLote: data.numeroLote,
        fechaVencimiento: data.fechaVencimiento,
        cantidad: 0,
        estado: 'DISPONIBLE',
      },
    });

    const existencia = await tx.existenciaInventario.upsert({
      where: {
        loteId_bodegaId: {
          loteId: lote.id,
          bodegaId: data.bodegaId,
        },
      },
      update: { cantidad: { increment: data.cantidad } },
      create: {
        loteId: lote.id,
        bodegaId: data.bodegaId,
        cantidad: data.cantidad,
      },
    });

    await tx.detalleIngresoInventario.create({
      data: {
        ingresoInventarioId: ingreso.id,
        detalleActaRecepcionId: data.detalleId,
        loteId: lote.id,
        cantidadIngresada: data.cantidad,
        costoUnitario: data.costoUnitario,
      },
    });

    const movimiento = await tx.movimientoInventario.create({
      data: {
        loteId: lote.id,
        tipo: 'INGRESO',
        cantidad: data.cantidad,
        bodegaDestinoId: data.bodegaId,
        usuarioId: data.usuarioId,
        ingresoInventarioId: ingreso.id,
        motivo: 'Ingreso de producto conforme por recepción técnica',
        referencia: data.numeroFactura,
      },
    });
    await this.inventoryDocuments.persistAutomaticMovementReceipt(
      tx,
      movimiento.id,
      data.usuarioId,
    );

    return { ingreso, lote, existencia, acta };
  }

  async registerReceipt(data: ReceiptInput) {
    return this.prisma.$transaction(async (tx) => {
      const numeroFactura = data.numeroFactura.trim();

      if (!numeroFactura || !data.productos.length) {
        throw new BadRequestException(
          'La factura y sus productos son obligatorios',
        );
      }

      const proveedor = await tx.proveedor.findUnique({
        where: { id: data.proveedorId },
      });

      if (!proveedor?.activo) {
        throw new NotFoundException('Proveedor inexistente o inactivo');
      }

      const bodega = await tx.bodega.findUnique({
        where: { id: data.bodegaDestinoId },
        include: { sede: true },
      });

      if (!bodega?.activa || !bodega.sede.activa) {
        throw new NotFoundException('Bodega o sede inactiva');
      }

      const usuario = await tx.usuario.findUnique({
        where: { id: data.usuarioId },
      });

      if (!usuario?.activo) {
        throw new NotFoundException('Usuario inexistente o inactivo');
      }

      const duplicada = await tx.actaRecepcion.findFirst({
        where: {
          proveedorId: data.proveedorId,
          numeroFactura,
          estado: { not: 'ANULADA' },
        },
      });

      if (duplicada) {
        throw new ConflictException('La factura ya existe para este proveedor');
      }

      const claves = new Set<string>();

      const validados = [] as Array<
        ReceiptProduct & {
          producto: Awaited<
            ReturnType<typeof tx.productoInventario.findUniqueOrThrow>
          >;
        }
      >;

      for (const item of data.productos) {
        const numeroLote = item.numeroLote.trim();

        if (
          !numeroLote ||
          !Number.isInteger(item.cantidad) ||
          item.cantidad <= 0
        ) {
          throw new BadRequestException('Número de lote o cantidad inválida');
        }

        if (Number.isNaN(item.fechaVencimiento.getTime())) {
          throw new BadRequestException('Vencimiento inválido');
        }

        if (
          item.costoUnitario !== undefined &&
          (!Number.isFinite(item.costoUnitario) || item.costoUnitario < 0)
        ) {
          throw new BadRequestException('Costo unitario inválido');
        }

        if (
          !Object.values(EstadoVerificacionInvima).includes(
            item.estadoVerificacionInvima,
          ) ||
          !Object.values(ResultadoVerificacionIngreso).includes(
            item.resultadoVerificacion,
          )
        ) {
          throw new BadRequestException('Verificación técnica inválida');
        }

        const clave = `${item.productoId}:${numeroLote}`;

        if (claves.has(clave)) {
          throw new ConflictException(
            'Producto y lote duplicados en la factura',
          );
        }

        claves.add(clave);

        const producto = await tx.productoInventario.findUnique({
          where: { id: item.productoId },
        });

        if (!producto || producto.estado !== 'ACTIVO') {
          throw new NotFoundException(
            `Producto ${item.productoId} inactivo o inexistente`,
          );
        }

        this.validateTechnicalResult({
          tipo: producto.tipo,
          numeroLote,
          fechaVencimiento: item.fechaVencimiento,
          resultado: item.resultadoVerificacion,
          invima: item.estadoVerificacionInvima,
          temperatura: item.temperaturaRegistrada,
          humedad: item.humedadRegistrada,
          temperaturaMinima: producto.temperaturaMinima,
          temperaturaMaxima: producto.temperaturaMaxima,
          humedadMaxima: producto.humedadMaxima,
          condicionConservacion: producto.condicionConservacion,
        });

        validados.push({ ...item, numeroLote, producto });
      }

      const conformes = validados.filter(
        (x) => x.resultadoVerificacion === 'CONFORME',
      );

      const pendientes = validados.filter(
        (x) => x.resultadoVerificacion === 'PENDIENTE',
      );

      const noConformes = validados.filter(
        (x) => x.resultadoVerificacion === 'NO_CONFORME',
      );

      const estado =
        pendientes.length === 0 && noConformes.length === 0
          ? 'APROBADA'
          : conformes.length === 0 && pendientes.length === 0
            ? 'RECHAZADA'
            : 'PENDIENTE_REVISION';

      const acta = await tx.actaRecepcion.create({
        data: {
          numeroActa: `ACT-${randomUUID()}`,
          sedeId: bodega.sedeId,
          bodegaDestinoId: bodega.id,
          proveedorId: proveedor.id,
          elaboradoPorId: data.usuarioId,
          numeroFactura,
          fechaFactura: data.fechaFactura,
          estado,
          observaciones: data.observaciones,
        },
      });

      const detalles = [] as Array<{
        productoId: number;
        loteId: number | null;
        numeroLote: string;
        cantidadRecibida: number;
        cantidadIngresada: number;
        existenciaActual: number | null;
        resultadoVerificacion: ResultadoVerificacionIngreso;
        estadoVerificacionInvima: EstadoVerificacionInvima;
      }>;

      let ingresoId: number | null = null;
      let numeroIngreso: string | null = null;

      for (const item of validados) {
        const detalle = await tx.detalleActaRecepcion.create({
          data: {
            actaRecepcionId: acta.id,
            productoId: item.productoId,
            numeroLote: item.numeroLote,
            fechaVencimiento: item.fechaVencimiento,
            cantidadRecibida: item.cantidad,
            registroInvima: item.producto.registroInvima,
            estadoVerificacionInvima: item.estadoVerificacionInvima,
            temperaturaRegistrada: item.temperaturaRegistrada,
            humedadRegistrada: item.humedadRegistrada,
            resultadoVerificacion: item.resultadoVerificacion,
            observaciones: item.observacionesVerificacion,
          },
        });

        if (item.resultadoVerificacion === 'CONFORME') {
          const stock = await this.addConformingStock(tx, {
            actaId: acta.id,
            detalleId: detalle.id,
            productoId: item.productoId,
            numeroLote: item.numeroLote,
            fechaVencimiento: item.fechaVencimiento,
            cantidad: item.cantidad,
            costoUnitario: item.costoUnitario,
            bodegaId: bodega.id,
            usuarioId: data.usuarioId,
            numeroFactura,
          });

          ingresoId = stock.ingreso.id;
          numeroIngreso = stock.ingreso.numeroIngreso;

          detalles.push({
            productoId: item.productoId,
            loteId: stock.lote.id,
            numeroLote: item.numeroLote,
            cantidadRecibida: item.cantidad,
            cantidadIngresada: item.cantidad,
            existenciaActual: stock.existencia.cantidad,
            resultadoVerificacion: item.resultadoVerificacion,
            estadoVerificacionInvima: item.estadoVerificacionInvima,
          });
        } else {
          detalles.push({
            productoId: item.productoId,
            loteId: null,
            numeroLote: item.numeroLote,
            cantidadRecibida: item.cantidad,
            cantidadIngresada: 0,
            existenciaActual: null,
            resultadoVerificacion: item.resultadoVerificacion,
            estadoVerificacionInvima: item.estadoVerificacionInvima,
          });
        }
      }

      return {
        mensaje: 'Recepción registrada correctamente con verificación técnica',
        actaId: acta.id,
        ingresoId,
        numeroIngreso,
        numeroActa: acta.numeroActa,
        numeroFactura,
        proveedor: proveedor.razonSocial,
        bodegaDestino: bodega.nombre,
        estado: acta.estado,
        totalProductos: validados.length,
        totalConformes: conformes.length,
        totalPendientes: pendientes.length,
        totalNoConformes: noConformes.length,
        detalles,
      };
    });
  }

  async reviewReceipt(data: ReviewInput) {
    return this.prisma.$transaction(async (tx) => {
      const acta = await tx.actaRecepcion.findUnique({
        where: { id: data.actaId },
        include: { ingresoInventario: true },
      });

      if (!acta || acta.estado === 'ANULADA') {
        throw new NotFoundException('Recepción no disponible');
      }

      if (!acta.bodegaDestinoId) {
        throw new BadRequestException(
          'La recepción no tiene bodega de destino',
        );
      }

      if (!data.productos.length) {
        throw new BadRequestException('No hay productos para revisar');
      }

      for (const item of data.productos) {
        const detalle = await tx.detalleActaRecepcion.findUnique({
          where: { id: item.detalleActaId },
          include: {
            producto: true,
            detalleIngreso: true,
            gestionNoConforme: true,
          },
        });

        if (!detalle || detalle.actaRecepcionId !== data.actaId) {
          throw new NotFoundException(
            'El detalle no pertenece a esta recepción',
          );
        }

        if (detalle.resultadoVerificacion !== 'PENDIENTE') {
          throw new BadRequestException(
            'Solo se pueden revisar productos pendientes',
          );
        }

        this.validateTechnicalResult({
          tipo: detalle.producto.tipo,
          numeroLote: detalle.numeroLote,
          fechaVencimiento: detalle.fechaVencimiento,
          resultado: item.resultadoVerificacion,
          invima: item.estadoVerificacionInvima,
          temperatura:
            item.temperaturaRegistrada ?? detalle.temperaturaRegistrada,
          humedad: item.humedadRegistrada ?? detalle.humedadRegistrada,
          temperaturaMinima: detalle.producto.temperaturaMinima,
          temperaturaMaxima: detalle.producto.temperaturaMaxima,
          humedadMaxima: detalle.producto.humedadMaxima,
          condicionConservacion: detalle.producto.condicionConservacion,
        });

        await tx.detalleActaRecepcion.update({
          where: { id: detalle.id },
          data: {
            resultadoVerificacion: item.resultadoVerificacion,
            estadoVerificacionInvima: item.estadoVerificacionInvima,
            temperaturaRegistrada: item.temperaturaRegistrada,
            humedadRegistrada: item.humedadRegistrada,
            observaciones: item.observaciones,
          },
        });

        if (item.resultadoVerificacion === 'CONFORME') {
          await this.addConformingStock(tx, {
            actaId: acta.id,
            detalleId: detalle.id,
            productoId: detalle.productoId,
            numeroLote: detalle.numeroLote,
            fechaVencimiento: detalle.fechaVencimiento,
            cantidad: detalle.cantidadRecibida,
            bodegaId: acta.bodegaDestinoId,
            usuarioId: data.usuarioId,
            numeroFactura: acta.numeroFactura ?? acta.numeroActa,
          });
        }
      }

      const detalles = await tx.detalleActaRecepcion.findMany({
        where: { actaRecepcionId: data.actaId },
      });

      const totalConformes = detalles.filter(
        (x) => x.resultadoVerificacion === 'CONFORME',
      ).length;

      const totalPendientes = detalles.filter(
        (x) => x.resultadoVerificacion === 'PENDIENTE',
      ).length;

      const totalNoConformes = detalles.filter(
        (x) => x.resultadoVerificacion === 'NO_CONFORME',
      ).length;

      const estado =
        totalPendientes === 0 && totalNoConformes === 0
          ? 'APROBADA'
          : totalConformes === 0 && totalPendientes === 0
            ? 'RECHAZADA'
            : 'PENDIENTE_REVISION';

      const actualizada = await tx.actaRecepcion.update({
        where: { id: data.actaId },
        data: {
          estado,
          revisadoPorId: data.usuarioId,
          fechaRevision: new Date(),
          ...(data.observaciones ? { observaciones: data.observaciones } : {}),
        },
        include: { ingresoInventario: true },
      });

      return {
        mensaje: 'Revisión técnica registrada correctamente',
        actaId: actualizada.id,
        numeroActa: actualizada.numeroActa,
        estado: actualizada.estado,
        ingresoId: actualizada.ingresoInventario?.id ?? null,
        numeroIngreso: actualizada.ingresoInventario?.numeroIngreso ?? null,
        totalConformes,
        totalPendientes,
        totalNoConformes,
      };
    });
  }

  async reevaluateReceiptProduct(data: {
    detalleActaId: number;
    usuarioId: number;
    resultadoNuevo: ResultadoVerificacionIngreso;
    estadoInvimaNuevo: EstadoVerificacionInvima;
    motivo: string;
    referencia: string;
    observaciones?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      if (!data.motivo?.trim() || !data.referencia?.trim()) {
        throw new BadRequestException(
          'El motivo y la referencia son obligatorios',
        );
      }

      if (data.resultadoNuevo === 'PENDIENTE') {
        throw new BadRequestException(
          'La reevaluación debe concluir CONFORME o NO_CONFORME',
        );
      }

      const detalle = await tx.detalleActaRecepcion.findUnique({
        where: { id: data.detalleActaId },
        include: {
          producto: true,
          actaRecepcion: true,
          gestionNoConforme: true,
          detalleIngreso: true,
        },
      });

      if (!detalle) {
        throw new NotFoundException('El detalle de recepción no existe');
      }

      if (detalle.actaRecepcion.estado === 'ANULADA') {
        throw new BadRequestException(
          'No se puede reevaluar una recepción anulada',
        );
      }

      if (detalle.resultadoVerificacion !== 'NO_CONFORME') {
        throw new BadRequestException(
          'Solo se pueden reevaluar productos no conformes',
        );
      }

      if (
        detalle.gestionNoConforme?.estado === 'DEVUELTO_PROVEEDOR' ||
        detalle.gestionNoConforme?.estado === 'REINTEGRADO'
      ) {
        throw new BadRequestException(
          'El producto ya tiene una disposición final',
        );
      }

      this.validateTechnicalResult({
        tipo: detalle.producto.tipo,
        numeroLote: detalle.numeroLote,
        fechaVencimiento: detalle.fechaVencimiento,
        resultado: data.resultadoNuevo,
        invima: data.estadoInvimaNuevo,
        temperatura: detalle.temperaturaRegistrada,
        humedad: detalle.humedadRegistrada,
        temperaturaMinima: detalle.producto.temperaturaMinima,
        temperaturaMaxima: detalle.producto.temperaturaMaxima,
        humedadMaxima: detalle.producto.humedadMaxima,
        condicionConservacion: detalle.producto.condicionConservacion,
      });

      const auditoria = await tx.reevaluacionTecnicaRecepcion.create({
        data: {
          detalleActaRecepcionId: detalle.id,
          responsableId: data.usuarioId,
          resultadoAnterior: detalle.resultadoVerificacion,
          resultadoNuevo: data.resultadoNuevo,
          estadoInvimaAnterior: detalle.estadoVerificacionInvima,
          estadoInvimaNuevo: data.estadoInvimaNuevo,
          motivo: data.motivo.trim(),
          referencia: data.referencia.trim(),
          observaciones: data.observaciones?.trim(),
          tipoCambio: 'REEVALUACION',
          temperaturaAnterior: detalle.temperaturaRegistrada,
          temperaturaNueva: detalle.temperaturaRegistrada,
          humedadAnterior: detalle.humedadRegistrada,
          humedadNueva: detalle.humedadRegistrada,
          observacionesAnteriores: detalle.observaciones,
          observacionesNuevas:
            data.observaciones?.trim() ?? detalle.observaciones,
        },
      });

      await tx.detalleActaRecepcion.update({
        where: { id: detalle.id },
        data: {
          resultadoVerificacion: data.resultadoNuevo,
          estadoVerificacionInvima: data.estadoInvimaNuevo,
          observaciones: data.observaciones?.trim() ?? detalle.observaciones,
        },
      });

      const detalles = await tx.detalleActaRecepcion.findMany({
        where: { actaRecepcionId: detalle.actaRecepcionId },
      });

      const conformes = detalles.filter(
        (x) => x.resultadoVerificacion === 'CONFORME',
      ).length;

      const pendientes = detalles.filter(
        (x) => x.resultadoVerificacion === 'PENDIENTE',
      ).length;

      const noConformes = detalles.filter(
        (x) => x.resultadoVerificacion === 'NO_CONFORME',
      ).length;

      const estado =
        pendientes === 0 && noConformes === 0
          ? 'APROBADA'
          : conformes === 0 && pendientes === 0
            ? 'RECHAZADA'
            : 'PENDIENTE_REVISION';

      await tx.actaRecepcion.update({
        where: { id: detalle.actaRecepcionId },
        data: {
          estado,
          revisadoPorId: data.usuarioId,
          fechaRevision: new Date(),
        },
      });

      return {
        mensaje:
          data.resultadoNuevo === 'CONFORME'
            ? 'Reevaluación registrada. La liberación de existencias requiere el proceso de reintegro autorizado.'
            : 'Reevaluación no conforme registrada correctamente',
        auditoriaId: auditoria.id,
        detalleActaId: detalle.id,
        resultadoAnterior: detalle.resultadoVerificacion,
        resultadoNuevo: data.resultadoNuevo,
        estado,
        requiereReintegro: data.resultadoNuevo === 'CONFORME',
      };
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
      if (!Number.isInteger(data.cantidad) || data.cantidad <= 0) {
        throw new BadRequestException('La cantidad debe ser mayor que cero');
      }

      if (data.bodegaOrigenId === data.bodegaDestinoId) {
        throw new BadRequestException('Las bodegas deben ser diferentes');
      }

      const existencia = await tx.existenciaInventario.findUnique({
        where: {
          loteId_bodegaId: {
            loteId: data.loteId,
            bodegaId: data.bodegaOrigenId,
          },
        },
      });

      if (!existencia) throw new Error('EXISTENCIA_ORIGEN_NO_ENCONTRADA');
      if (existencia.cantidad < data.cantidad) {
        throw new Error('STOCK_INSUFICIENTE');
      }

      const origen = await tx.existenciaInventario.update({
        where: {
          loteId_bodegaId: {
            loteId: data.loteId,
            bodegaId: data.bodegaOrigenId,
          },
        },
        data: { cantidad: { decrement: data.cantidad } },
      });

      const destino = await tx.existenciaInventario.upsert({
        where: {
          loteId_bodegaId: {
            loteId: data.loteId,
            bodegaId: data.bodegaDestinoId,
          },
        },
        update: { cantidad: { increment: data.cantidad } },
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
      await this.inventoryDocuments.persistAutomaticMovementReceipt(
        tx,
        movimiento.id,
        data.usuarioId,
      );

      return { origen, destino, movimiento };
    });
  }

  // TRASLADO AGRUPADO: UNA TRANSACCIÓN PARA TODOS LOS LOTES

  async transferStockBatch(data: {
    bodegaOrigenId: number;
    bodegaDestinoId: number;
    usuarioId: number;
    motivo: string;
    productos: { loteId: number; cantidad: number }[];
  }) {
    if (data.bodegaOrigenId === data.bodegaDestinoId) {
      throw new BadRequestException('Las bodegas deben ser diferentes');
    }

    if (!data.motivo?.trim()) {
      throw new BadRequestException('El motivo del traslado es obligatorio');
    }

    if (!Array.isArray(data.productos) || data.productos.length === 0) {
      throw new BadRequestException('Agrega al menos un lote al traslado');
    }

    const ids = new Set<number>();

    for (const item of data.productos) {
      if (
        !Number.isInteger(item.loteId) ||
        item.loteId <= 0 ||
        !Number.isInteger(item.cantidad) ||
        item.cantidad <= 0
      ) {
        throw new BadRequestException('Lote o cantidad inválida');
      }

      if (ids.has(item.loteId)) {
        throw new ConflictException(
          'No puedes incluir el mismo lote dos veces',
        );
      }

      ids.add(item.loteId);
    }

    return this.prisma.$transaction(async (tx) => {
      const [origen, destino] = await Promise.all([
        tx.bodega.findUnique({
          where: { id: data.bodegaOrigenId },
          include: { sede: true },
        }),
        tx.bodega.findUnique({
          where: { id: data.bodegaDestinoId },
          include: { sede: true },
        }),
      ]);

      if (
        !origen?.activa ||
        !origen.sede.activa ||
        !origen.permiteDispensacion
      ) {
        throw new BadRequestException(
          'La bodega de origen no está habilitada para traslados normales',
        );
      }

      if (!destino?.activa || !destino.sede.activa) {
        throw new BadRequestException('La bodega de destino no está activa');
      }

      const referencia = `TR-${randomUUID()}`;
      const movimientos = [];

      const items = [...data.productos].sort((a, b) => a.loteId - b.loteId);

      for (const item of items) {
        const lote = await tx.loteInventario.findUnique({
          where: { id: item.loteId },
        });

        if (!lote || lote.estado !== 'DISPONIBLE') {
          throw new BadRequestException(
            `El lote ${item.loteId} no está disponible`,
          );
        }

        const producto = await tx.productoInventario.findUnique({
          where: { id: lote.productoInventarioId },
        });

        if (!producto || producto.estado !== 'ACTIVO') {
          throw new BadRequestException(
            `El producto del lote ${lote.numeroLote} no está activo`,
          );
        }

        if (lote.fechaVencimiento.getTime() < Date.now()) {
          throw new BadRequestException(
            `El lote ${lote.numeroLote} está vencido`,
          );
        }

        const descontado = await tx.existenciaInventario.updateMany({
          where: {
            loteId: item.loteId,
            bodegaId: data.bodegaOrigenId,
            cantidad: { gte: item.cantidad },
          },
          data: { cantidad: { decrement: item.cantidad } },
        });

        if (descontado.count !== 1) {
          throw new BadRequestException(
            `Existencias insuficientes para el lote ${lote.numeroLote}`,
          );
        }

        await tx.existenciaInventario.upsert({
          where: {
            loteId_bodegaId: {
              loteId: item.loteId,
              bodegaId: data.bodegaDestinoId,
            },
          },
          update: { cantidad: { increment: item.cantidad } },
          create: {
            loteId: item.loteId,
            bodegaId: data.bodegaDestinoId,
            cantidad: item.cantidad,
          },
        });

        const movimiento = await tx.movimientoInventario.create({
          data: {
            loteId: item.loteId,
            tipo: 'TRASLADO',
            cantidad: item.cantidad,
            bodegaOrigenId: data.bodegaOrigenId,
            bodegaDestinoId: data.bodegaDestinoId,
            usuarioId: data.usuarioId,
            motivo: data.motivo.trim(),
            referencia,
          },
        });

        await this.inventoryDocuments.persistAutomaticMovementReceipt(
          tx,
          movimiento.id,
          data.usuarioId,
        );

        movimientos.push(movimiento);
      }

      return {
        mensaje: 'Traslado múltiple registrado correctamente',
        referencia,
        totalLotes: movimientos.length,
        totalUnidades: movimientos.reduce((sum, m) => sum + m.cantidad, 0),
        movimientos,
      };
    });
  }

  // AJUSTE INDIVIDUAL EXISTENTE

  async adjustStock(data: {
    loteId: number;
    bodegaId: number;
    tipo: 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA';
    cantidad: number;
    usuarioId: number;
    motivo: string;
    referencia?: string;
    soporte?: {
      claveAlmacenamiento: string;
      sha256: string;
      mime: string;
      tamano: number;
    };
  }) {
    return this.prisma.$transaction(async (tx) => {
      if (!Number.isInteger(data.cantidad) || data.cantidad <= 0) {
        throw new BadRequestException('La cantidad debe ser mayor que cero');
      }

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

      const actualizada = await tx.existenciaInventario.upsert({
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
      await this.inventoryDocuments.persistAutomaticMovementReceipt(
        tx,
        movimiento.id,
        data.usuarioId,
      );

      if (data.soporte) {
        const documento = await tx.documentoInventario.create({
          data: { ...data.soporte, creadoPorId: data.usuarioId },
        });
        await tx.documentoMovimientoInventario.create({
          data: {
            movimientoInventarioId: movimiento.id,
            documentoInventarioId: documento.id,
            proposito: 'SOPORTE_AJUSTE',
            version: 1,
            registradoPorId: data.usuarioId,
          },
        });
      }

      return { existencia: actualizada, movimiento };
    });
  }

  // AJUSTE MÚLTIPLE POR CONTEO FÍSICO

  async adjustStockBatch(data: {
    bodegaId: number;
    usuarioId: number;
    motivo: string;
    referencia?: string;
    productos: {
      loteId: number;
      cantidadFisica: number;
    }[];
    soporte?: {
      claveAlmacenamiento: string;
      sha256: string;
      mime: string;
      tamano: number;
    };
  }) {
    if (!Number.isInteger(data.bodegaId) || data.bodegaId <= 0) {
      throw new BadRequestException('Debes seleccionar una bodega válida');
    }

    if (!data.motivo?.trim()) {
      throw new BadRequestException('El motivo del ajuste es obligatorio');
    }

    if (!Array.isArray(data.productos) || data.productos.length === 0) {
      throw new BadRequestException(
        'Debes agregar al menos un producto al ajuste',
      );
    }

    const lotesSeleccionados = new Set<number>();

    for (const item of data.productos) {
      if (
        !Number.isInteger(item.loteId) ||
        item.loteId <= 0 ||
        !Number.isInteger(item.cantidadFisica) ||
        item.cantidadFisica < 0
      ) {
        throw new BadRequestException(
          'El lote o la cantidad física no son válidos',
        );
      }

      if (lotesSeleccionados.has(item.loteId)) {
        throw new ConflictException(`El lote ${item.loteId} está repetido`);
      }

      lotesSeleccionados.add(item.loteId);
    }

    return this.prisma.$transaction(
      async (tx) => {
        const bodega = await tx.bodega.findUnique({
          where: { id: data.bodegaId },
          include: { sede: true },
        });

        if (!bodega || !bodega.activa || !bodega.sede.activa) {
          throw new BadRequestException('La bodega o su sede no están activas');
        }

        if (!bodega.permiteDispensacion) {
          throw new BadRequestException(
            'Esta operación solo admite bodegas habilitadas para dispensación',
          );
        }

        const referencia = data.referencia?.trim() || `AJ-${randomUUID()}`;

        const movimientos = [];
        const resultados = [];

        const productosOrdenados = [...data.productos].sort(
          (a, b) => a.loteId - b.loteId,
        );

        for (const item of productosOrdenados) {
          const lote = await tx.loteInventario.findUnique({
            where: { id: item.loteId },
          });

          if (!lote) {
            throw new NotFoundException(`El lote ${item.loteId} no existe`);
          }

          if (lote.estado !== 'DISPONIBLE') {
            throw new BadRequestException(
              `El lote ${lote.numeroLote} no está disponible para ajustes normales`,
            );
          }

          const producto = await tx.productoInventario.findUnique({
            where: { id: lote.productoInventarioId },
          });

          if (!producto || producto.estado !== 'ACTIVO') {
            throw new BadRequestException(
              `El producto del lote ${lote.numeroLote} no está activo`,
            );
          }

          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);

          const vencimiento = new Date(lote.fechaVencimiento);
          vencimiento.setHours(0, 0, 0, 0);

          if (vencimiento < hoy) {
            throw new BadRequestException(
              `El lote ${lote.numeroLote} está vencido`,
            );
          }

          const existencia = await tx.existenciaInventario.findUnique({
            where: {
              loteId_bodegaId: {
                loteId: item.loteId,
                bodegaId: data.bodegaId,
              },
            },
          });

          if (!existencia) {
            throw new BadRequestException(
              `El lote ${lote.numeroLote} no tiene un registro de existencias en esta bodega`,
            );
          }

          const cantidadAnterior = existencia.cantidad;
          const cantidadFisica = item.cantidadFisica;
          const diferencia = cantidadFisica - cantidadAnterior;

          if (diferencia === 0) {
            resultados.push({
              loteId: item.loteId,
              numeroLote: lote.numeroLote,
              cantidadAnterior,
              cantidadFisica,
              diferencia: 0,
              estado: 'SIN_DIFERENCIA',
            });

            continue;
          }

          const tipo: 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA' =
            diferencia > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA';

          const cantidadAjustada = Math.abs(diferencia);

          const actualizacion = await tx.existenciaInventario.updateMany({
            where: {
              loteId: item.loteId,
              bodegaId: data.bodegaId,
              cantidad: cantidadAnterior,
            },
            data: {
              cantidad: cantidadFisica,
            },
          });

          if (actualizacion.count !== 1) {
            throw new ConflictException(
              `Las existencias del lote ${lote.numeroLote} cambiaron durante el ajuste. Actualiza la información y vuelve a intentarlo.`,
            );
          }

          const movimiento = await tx.movimientoInventario.create({
            data: {
              loteId: item.loteId,
              tipo,
              cantidad: cantidadAjustada,
              bodegaOrigenId:
                tipo === 'AJUSTE_SALIDA' ? data.bodegaId : undefined,
              bodegaDestinoId:
                tipo === 'AJUSTE_ENTRADA' ? data.bodegaId : undefined,
              usuarioId: data.usuarioId,
              motivo: data.motivo.trim(),
              referencia,
            },
          });

          await this.inventoryDocuments.persistAutomaticMovementReceipt(
            tx,
            movimiento.id,
            data.usuarioId,
          );

          movimientos.push(movimiento);

          resultados.push({
            loteId: item.loteId,
            numeroLote: lote.numeroLote,
            cantidadAnterior,
            cantidadFisica,
            diferencia,
            tipo,
            estado: 'AJUSTADO',
          });
        }

        if (data.soporte && movimientos.length > 0) {
          const documento = await tx.documentoInventario.create({
            data: {
              ...data.soporte,
              creadoPorId: data.usuarioId,
            },
          });

          await tx.documentoMovimientoInventario.createMany({
            data: movimientos.map((movimiento) => ({
              movimientoInventarioId: movimiento.id,
              documentoInventarioId: documento.id,
              proposito: 'SOPORTE_AJUSTE',
              version: 1,
              registradoPorId: data.usuarioId,
            })),
          });
        }

        return {
          mensaje: 'Conteo físico procesado correctamente',
          referencia,
          bodegaId: data.bodegaId,
          totalLotesRevisados: resultados.length,
          totalLotesAjustados: movimientos.length,
          resultados,
          movimientos,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}
