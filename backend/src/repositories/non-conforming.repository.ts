import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryDocumentsService } from '../inventory/inventory-documents.service';

interface RegistrarCustodiaData {
  detalleActaRecepcionId: number;
  bodegaId: number;
  usuarioId: number;
  motivo: string;
  observaciones?: string;
}

interface RegistrarCustodiaInventarioData {
  loteId: number;
  bodegaOrigenId: number;
  bodegaDestinoId: number;
  cantidad: number;
  usuarioId: number;
  motivo: string;
  referencia?: string;
  observaciones?: string;
  origen?: 'ALMACENAMIENTO' | 'VENCIMIENTO';
}

interface RegistrarDevolucionData {
  gestionId: number;
  usuarioId: number;
  motivo: string;
  referencia: string;
  tipoDisposicion?: 'DEVOLUCION_PROVEEDOR' | 'CAMBIO_FISICO';
  observaciones?: string;
}

interface ReintegrarInventarioData {
  gestionId: number;
  bodegaDestinoId: number;
  usuarioId: number;
  motivo: string;
  referencia: string;
  observaciones?: string;
}

@Injectable()
export class NonConformingRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryDocuments: InventoryDocumentsService,
  ) {}

  // =====================================================
  // CONSULTAR PRODUCTOS NO CONFORMES
  // =====================================================

  async findAll() {
    const [detalles, gestionesInventario] = await Promise.all([
      this.prisma.detalleActaRecepcion.findMany({
        where: {
          resultadoVerificacion: 'NO_CONFORME',
          actaRecepcion: {
            estado: { not: 'ANULADA' },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          producto: true,
          actaRecepcion: {
            include: {
              proveedor: true,
              sede: true,
            },
          },
          gestionNoConforme: {
            include: {
              bodega: true,
              bodegaOrigen: true,
              responsable: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.gestionNoConforme.findMany({
        where: {
          origen: {
            in: ['ALMACENAMIENTO', 'VENCIMIENTO'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          lote: {
            include: {
              productoInventario: true,
            },
          },
          bodega: {
            include: {
              sede: true,
            },
          },
          bodegaOrigen: true,
          responsable: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      }),
    ]);

    const productosRecepcion = detalles.map((detalle) => {
      const gestion = detalle.gestionNoConforme;

      return {
        detalleActaId: detalle.id,
        actaId: detalle.actaRecepcionId,
        numeroActa: detalle.actaRecepcion.numeroActa,
        numeroFactura: detalle.actaRecepcion.numeroFactura,
        proveedor: detalle.actaRecepcion.proveedor.razonSocial,
        sede: detalle.actaRecepcion.sede.nombre,
        productoId: detalle.productoId,
        producto: detalle.producto.descripcion,
        tipo: detalle.producto.tipo,
        numeroLote: detalle.numeroLote,
        fechaVencimiento: detalle.fechaVencimiento,
        cantidadRecibida: detalle.cantidadRecibida,
        resultadoVerificacion: detalle.resultadoVerificacion,
        observacionesVerificacion: detalle.observaciones,
        origen: 'RECEPCION' as const,
        gestion: gestion
          ? {
              id: gestion.id,
              estado: gestion.estado,
              origen: gestion.origen,
              cantidad: gestion.cantidad,
              motivo: gestion.motivo,
              disposicion: gestion.disposicion,
              observaciones: gestion.observaciones,
              bodega: gestion.bodega?.nombre ?? null,
              bodegaOrigen: gestion.bodegaOrigen?.nombre ?? null,
              responsable: gestion.responsable?.nombre ?? null,
              fechaIngresoCustodia: gestion.fechaIngresoCustodia,
              fechaCierre: gestion.fechaCierre,
            }
          : null,
      };
    });

    const productosInventario = gestionesInventario.map((gestion) => ({
      detalleActaId: null,
      actaId: null,
      numeroActa: null,
      numeroFactura: null,
      proveedor: null,
      sede: gestion.bodega?.sede.nombre ?? null,
      productoId: gestion.lote?.productoInventarioId ?? null,
      producto: gestion.lote?.productoInventario.descripcion ?? null,
      tipo: gestion.lote?.productoInventario.tipo ?? null,
      numeroLote: gestion.lote?.numeroLote ?? null,
      fechaVencimiento: gestion.lote?.fechaVencimiento ?? null,
      cantidadRecibida: gestion.cantidad,
      resultadoVerificacion: 'NO_CONFORME' as const,
      observacionesVerificacion: gestion.motivo,
      origen: gestion.origen,
      gestion: {
        id: gestion.id,
        estado: gestion.estado,
        origen: gestion.origen,
        cantidad: gestion.cantidad,
        motivo: gestion.motivo,
        disposicion: gestion.disposicion,
        observaciones: gestion.observaciones,
        bodega: gestion.bodega?.nombre ?? null,
        bodegaOrigen: gestion.bodegaOrigen?.nombre ?? null,
        responsable: gestion.responsable?.nombre ?? null,
        fechaIngresoCustodia: gestion.fechaIngresoCustodia,
        fechaCierre: gestion.fechaCierre,
      },
    }));

    const productos = [...productosRecepcion, ...productosInventario];

    return {
      total: productos.length,
      productos,
    };
  }

  // =====================================================
  // CONSULTAR UNA GESTIÓN
  // =====================================================

  async findById(gestionId: number) {
    const gestion = await this.prisma.gestionNoConforme.findUnique({
      where: {
        id: gestionId,
      },
      include: {
        bodega: true,
        bodegaOrigen: true,
        lote: {
          include: {
            productoInventario: true,
          },
        },
        responsable: {
          select: {
            id: true,
            nombre: true,
          },
        },
        detalleActaRecepcion: {
          include: {
            producto: true,
            actaRecepcion: {
              include: {
                proveedor: true,
              },
            },
          },
        },
      },
    });

    if (!gestion) {
      throw new NotFoundException(
        'No existe la gestión del producto no conforme',
      );
    }

    return gestion;
  }

  // =====================================================
  // CUSTODIA DE PRODUCTOS NO CONFORMES DE RECEPCIÓN
  // =====================================================

  async registerCustody(data: RegistrarCustodiaData) {
    if (!data.motivo?.trim()) {
      throw new BadRequestException(
        'Debes registrar el motivo de la no conformidad',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const detalle = await tx.detalleActaRecepcion.findUnique({
        where: {
          id: data.detalleActaRecepcionId,
        },
        include: {
          actaRecepcion: true,
          gestionNoConforme: true,
        },
      });

      if (!detalle) {
        throw new NotFoundException('No existe el detalle de recepción');
      }

      if (detalle.resultadoVerificacion !== 'NO_CONFORME') {
        throw new BadRequestException(
          'Solo se pueden gestionar productos no conformes',
        );
      }

      if (detalle.actaRecepcion.estado === 'ANULADA') {
        throw new BadRequestException(
          'No se pueden gestionar productos de un acta anulada',
        );
      }

      if (detalle.gestionNoConforme) {
        throw new ConflictException(
          'Este producto ya tiene una gestión registrada',
        );
      }

      if (detalle.cantidadRecibida <= 0) {
        throw new BadRequestException(
          'La cantidad recibida debe ser mayor que cero',
        );
      }

      const bodega = await tx.bodega.findUnique({
        where: {
          id: data.bodegaId,
        },
        include: {
          sede: true,
        },
      });

      if (!bodega || !bodega.activa || !bodega.sede.activa) {
        throw new NotFoundException('La bodega no existe o está inactiva');
      }

      if (bodega.tipo !== 'NO_CONFORMES' || bodega.permiteDispensacion) {
        throw new BadRequestException(
          'Debes seleccionar una bodega de Productos No Conformes que no permita dispensación',
        );
      }

      if (bodega.sedeId !== detalle.actaRecepcion.sedeId) {
        throw new BadRequestException(
          'La bodega debe pertenecer a la sede del acta',
        );
      }

      const usuario = await tx.usuario.findUnique({
        where: {
          id: data.usuarioId,
        },
      });

      if (!usuario || !usuario.activo) {
        throw new NotFoundException(
          'El usuario responsable no existe o está inactivo',
        );
      }

      const loteExistente = await tx.loteInventario.findUnique({
        where: {
          productoInventarioId_numeroLote: {
            productoInventarioId: detalle.productoId,
            numeroLote: detalle.numeroLote,
          },
        },
      });

      if (
        loteExistente &&
        loteExistente.fechaVencimiento.getTime() !==
          detalle.fechaVencimiento.getTime()
      ) {
        throw new ConflictException(
          'El lote ya existe con otra fecha de vencimiento',
        );
      }

      const lote = await tx.loteInventario.upsert({
        where: {
          productoInventarioId_numeroLote: {
            productoInventarioId: detalle.productoId,
            numeroLote: detalle.numeroLote,
          },
        },
        update: {},
        create: {
          productoInventarioId: detalle.productoId,
          numeroLote: detalle.numeroLote,
          fechaVencimiento: detalle.fechaVencimiento,
          cantidad: 0,
          estado: 'DISPONIBLE',
        },
      });

      const gestion = await tx.gestionNoConforme.create({
        data: {
          detalleActaRecepcionId: detalle.id,
          loteId: lote.id,
          bodegaId: bodega.id,
          cantidad: detalle.cantidadRecibida,
          origen: 'RECEPCION',
          estado: 'EN_CUSTODIA',
          motivo: data.motivo.trim(),
          observaciones: data.observaciones?.trim(),
          fechaIngresoCustodia: new Date(),
          responsableId: data.usuarioId,
        },
      });

      const existencia = await tx.existenciaInventario.upsert({
        where: {
          loteId_bodegaId: {
            loteId: lote.id,
            bodegaId: bodega.id,
          },
        },
        update: {
          cantidad: {
            increment: detalle.cantidadRecibida,
          },
        },
        create: {
          loteId: lote.id,
          bodegaId: bodega.id,
          cantidad: detalle.cantidadRecibida,
        },
      });

      const movimiento = await tx.movimientoInventario.create({
        data: {
          loteId: lote.id,
          tipo: 'AJUSTE_ENTRADA',
          cantidad: detalle.cantidadRecibida,
          bodegaDestinoId: bodega.id,
          usuarioId: data.usuarioId,
          motivo: `Ingreso a custodia por no conformidad: ${data.motivo.trim()}`,
          referencia: `GEST-NC-${gestion.id} / ${detalle.actaRecepcion.numeroActa}`,
        },
      });
      await this.inventoryDocuments.persistAutomaticMovementReceipt(
        tx,
        movimiento.id,
        data.usuarioId,
      );

      return {
        mensaje: 'Producto registrado en custodia correctamente',
        gestionId: gestion.id,
        detalleActaId: detalle.id,
        numeroActa: detalle.actaRecepcion.numeroActa,
        loteId: lote.id,
        numeroLote: lote.numeroLote,
        cantidad: gestion.cantidad,
        bodega: bodega.nombre,
        existenciaActual: existencia.cantidad,
        estado: gestion.estado,
        origen: gestion.origen,
      };
    });
  }

  // =====================================================
  // CUSTODIA DESDE INVENTARIO EXISTENTE
  // =====================================================

  async registerInventoryCustody(data: RegistrarCustodiaInventarioData) {
    if (
      !Number.isInteger(data.loteId) ||
      data.loteId <= 0 ||
      !Number.isInteger(data.bodegaOrigenId) ||
      data.bodegaOrigenId <= 0 ||
      !Number.isInteger(data.bodegaDestinoId) ||
      data.bodegaDestinoId <= 0 ||
      !Number.isInteger(data.cantidad) ||
      data.cantidad <= 0 ||
      !Number.isInteger(data.usuarioId) ||
      data.usuarioId <= 0
    ) {
      throw new BadRequestException(
        'Debes indicar lote, bodegas, cantidad y responsable válidos',
      );
    }

    if (!data.motivo?.trim()) {
      throw new BadRequestException(
        'Debes registrar el motivo de la no conformidad',
      );
    }

    if (data.bodegaOrigenId === data.bodegaDestinoId) {
      throw new BadRequestException(
        'La bodega de origen y destino deben ser diferentes',
      );
    }

    const origenGestion = data.origen ?? 'ALMACENAMIENTO';

    if (origenGestion !== 'ALMACENAMIENTO' && origenGestion !== 'VENCIMIENTO') {
      throw new BadRequestException('El origen de la gestión no es válido');
    }

    return this.prisma.$transaction(async (tx) => {
      const lote = await tx.loteInventario.findUnique({
        where: {
          id: data.loteId,
        },
        include: {
          productoInventario: true,
        },
      });

      if (!lote) {
        throw new NotFoundException('No existe el lote seleccionado');
      }

      const [bodegaOrigen, bodegaDestino, usuario] = await Promise.all([
        tx.bodega.findUnique({
          where: {
            id: data.bodegaOrigenId,
          },
          include: {
            sede: true,
          },
        }),
        tx.bodega.findUnique({
          where: {
            id: data.bodegaDestinoId,
          },
          include: {
            sede: true,
          },
        }),
        tx.usuario.findUnique({
          where: {
            id: data.usuarioId,
          },
        }),
      ]);

      if (!bodegaOrigen || !bodegaOrigen.activa || !bodegaOrigen.sede.activa) {
        throw new BadRequestException(
          'La bodega de origen no existe o está inactiva',
        );
      }

      if (
        !bodegaDestino ||
        !bodegaDestino.activa ||
        !bodegaDestino.sede.activa
      ) {
        throw new BadRequestException(
          'La bodega de destino no existe o está inactiva',
        );
      }

      if (bodegaOrigen.tipo === 'NO_CONFORMES') {
        throw new BadRequestException(
          'No puedes registrar una nueva custodia desde una bodega de Productos No Conformes',
        );
      }

      if (
        bodegaDestino.tipo !== 'NO_CONFORMES' ||
        bodegaDestino.permiteDispensacion
      ) {
        throw new BadRequestException(
          'El destino debe ser una bodega de Productos No Conformes que no permita dispensación',
        );
      }

      if (bodegaOrigen.sedeId !== bodegaDestino.sedeId) {
        throw new BadRequestException(
          'Las bodegas deben pertenecer a la misma sede',
        );
      }

      if (!usuario || !usuario.activo) {
        throw new NotFoundException(
          'El usuario responsable no existe o está inactivo',
        );
      }

      if (origenGestion === 'VENCIMIENTO') {
        if (lote.fechaVencimiento > new Date()) {
          throw new BadRequestException('El lote todavía no está vencido');
        }
      } else if (
        lote.fechaVencimiento <= new Date() ||
        lote.estado === 'VENCIDO'
      ) {
        throw new BadRequestException(
          'Los lotes vencidos deben gestionarse como productos vencidos',
        );
      }

      const salida = await tx.existenciaInventario.updateMany({
        where: {
          loteId: lote.id,
          bodegaId: bodegaOrigen.id,
          cantidad: {
            gte: data.cantidad,
          },
        },
        data: {
          cantidad: {
            decrement: data.cantidad,
          },
        },
      });

      if (salida.count !== 1) {
        throw new ConflictException(
          'La bodega de origen no tiene existencias suficientes para el traslado',
        );
      }

      const gestion = await tx.gestionNoConforme.create({
        data: {
          loteId: lote.id,
          bodegaOrigenId: bodegaOrigen.id,
          bodegaId: bodegaDestino.id,
          cantidad: data.cantidad,
          origen: origenGestion,
          estado: 'EN_CUSTODIA',
          motivo: data.motivo.trim(),
          observaciones: data.observaciones?.trim(),
          fechaIngresoCustodia: new Date(),
          responsableId: usuario.id,
        },
      });

      const existenciaDestino = await tx.existenciaInventario.upsert({
        where: {
          loteId_bodegaId: {
            loteId: lote.id,
            bodegaId: bodegaDestino.id,
          },
        },
        create: {
          loteId: lote.id,
          bodegaId: bodegaDestino.id,
          cantidad: data.cantidad,
        },
        update: {
          cantidad: {
            increment: data.cantidad,
          },
        },
      });

      const referencia = data.referencia?.trim();

      const movimiento = await tx.movimientoInventario.create({
        data: {
          loteId: lote.id,
          tipo: 'TRASLADO',
          cantidad: data.cantidad,
          bodegaOrigenId: bodegaOrigen.id,
          bodegaDestinoId: bodegaDestino.id,
          usuarioId: usuario.id,
          motivo: `Traslado a Productos No Conformes: ${data.motivo.trim()}`,
          referencia: referencia
            ? `${referencia} / GEST-NC-${gestion.id}`
            : `GEST-NC-${gestion.id}`,
        },
      });
      await this.inventoryDocuments.persistAutomaticMovementReceipt(
        tx,
        movimiento.id,
        usuario.id,
      );

      return {
        mensaje: 'Producto trasladado a custodia de no conformes correctamente',
        gestionId: gestion.id,
        movimientoId: movimiento.id,
        loteId: lote.id,
        numeroLote: lote.numeroLote,
        producto: lote.productoInventario.descripcion,
        origen: gestion.origen,
        estado: gestion.estado,
        cantidadTrasladada: gestion.cantidad,
        bodegaOrigen: bodegaOrigen.nombre,
        bodegaDestino: bodegaDestino.nombre,
        existenciaDestino: existenciaDestino.cantidad,
      };
    });
  }

  // =====================================================
  // DEVOLVER PRODUCTO NO CONFORME AL PROVEEDOR
  // =====================================================

  async returnToSupplier(data: RegistrarDevolucionData) {
    if (
      !Number.isInteger(data.gestionId) ||
      data.gestionId <= 0 ||
      !Number.isInteger(data.usuarioId) ||
      data.usuarioId <= 0 ||
      !data.motivo?.trim() ||
      !data.referencia?.trim()
    ) {
      throw new BadRequestException(
        'La gestión, el responsable, el motivo y la referencia son obligatorios',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const gestion = await tx.gestionNoConforme.findUnique({
        where: {
          id: data.gestionId,
        },
        include: {
          detalleActaRecepcion: true,
          lote: true,
        },
      });

      if (!gestion) {
        throw new NotFoundException(
          'No existe la gestión del producto no conforme',
        );
      }

      if (gestion.estado !== 'EN_CUSTODIA' || !gestion.bodegaId) {
        throw new ConflictException(
          'El producto no está disponible para devolución',
        );
      }

      if (gestion.cantidad <= 0) {
        throw new ConflictException(
          'La cantidad registrada en custodia no es válida',
        );
      }

      const usuario = await tx.usuario.findUnique({
        where: {
          id: data.usuarioId,
        },
      });

      if (!usuario || !usuario.activo) {
        throw new NotFoundException(
          'El usuario responsable no existe o está inactivo',
        );
      }

      let lote = gestion.lote;

      if (!lote && gestion.detalleActaRecepcion) {
        const detalle = gestion.detalleActaRecepcion;

        lote = await tx.loteInventario.findUnique({
          where: {
            productoInventarioId_numeroLote: {
              productoInventarioId: detalle.productoId,
              numeroLote: detalle.numeroLote,
            },
          },
        });
      }

      if (!lote) {
        throw new NotFoundException(
          'No se encontró el lote asociado a la gestión',
        );
      }

      const salida = await tx.existenciaInventario.updateMany({
        where: {
          loteId: lote.id,
          bodegaId: gestion.bodegaId,
          cantidad: {
            gte: gestion.cantidad,
          },
        },
        data: {
          cantidad: {
            decrement: gestion.cantidad,
          },
        },
      });

      if (salida.count !== 1) {
        throw new ConflictException(
          'No existe suficiente cantidad en la bodega de no conformes',
        );
      }

      const cierre = await tx.gestionNoConforme.updateMany({
        where: {
          id: gestion.id,
          estado: 'EN_CUSTODIA',
        },
        data: {
          estado: 'DEVUELTO_PROVEEDOR',
          disposicion: data.tipoDisposicion ?? 'DEVOLUCION_PROVEEDOR',
          fechaCierre: new Date(),
          responsableId: usuario.id,
          observaciones: data.observaciones?.trim(),
        },
      });

      if (cierre.count !== 1) {
        throw new ConflictException(
          'Esta gestión ya fue cerrada por otra operación',
        );
      }

      const movimiento = await tx.movimientoInventario.create({
        data: {
          loteId: lote.id,
          tipo: 'DEVOLUCION_PROVEEDOR',
          cantidad: gestion.cantidad,
          bodegaOrigenId: gestion.bodegaId,
          usuarioId: usuario.id,
          motivo: data.motivo.trim(),
          referencia: `${data.referencia.trim()} / GEST-NC-${gestion.id}`,
        },
      });
      await this.inventoryDocuments.persistAutomaticMovementReceipt(
        tx,
        movimiento.id,
        usuario.id,
      );

      return {
        mensaje: 'Devolución al proveedor registrada correctamente',
        gestionId: gestion.id,
        estado: 'DEVUELTO_PROVEEDOR',
        origen: gestion.origen,
        cantidadDevuelta: gestion.cantidad,
        numeroLote: lote.numeroLote,
        movimientoId: movimiento.id,
        referencia: data.referencia.trim(),
      };
    });
  }

  // =====================================================
  // REINTEGRAR PRODUCTO DESDE CUSTODIA
  // =====================================================

  async reintegrateToInventory(data: ReintegrarInventarioData) {
    if (
      !Number.isInteger(data.gestionId) ||
      data.gestionId <= 0 ||
      !Number.isInteger(data.bodegaDestinoId) ||
      data.bodegaDestinoId <= 0 ||
      !Number.isInteger(data.usuarioId) ||
      data.usuarioId <= 0 ||
      !data.motivo?.trim() ||
      !data.referencia?.trim()
    ) {
      throw new BadRequestException(
        'Debes indicar una gestión, bodega, responsable, motivo y referencia válidos',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const gestion = await tx.gestionNoConforme.findUnique({
        where: {
          id: data.gestionId,
        },
        include: {
          lote: true,
          bodega: true,
          detalleActaRecepcion: {
            include: {
              actaRecepcion: true,
            },
          },
        },
      });

      if (!gestion) {
        throw new NotFoundException('No existe la gestión no conforme');
      }

      if (gestion.estado !== 'EN_CUSTODIA' || !gestion.bodegaId) {
        throw new ConflictException(
          'El producto no se encuentra disponible en custodia',
        );
      }

      if (gestion.cantidad <= 0) {
        throw new ConflictException('La cantidad de custodia no es válida');
      }

      if (gestion.bodegaId === data.bodegaDestinoId) {
        throw new BadRequestException(
          'La bodega de destino debe ser diferente a la de custodia',
        );
      }

      const usuario = await tx.usuario.findUnique({
        where: {
          id: data.usuarioId,
        },
      });

      if (!usuario || !usuario.activo) {
        throw new NotFoundException('El usuario responsable no está activo');
      }

      const rolesAutorizados = [
        'ADMINISTRADOR',
        'QUIMICO_FARMACEUTICO',
        'REGENTE_FARMACIA',
      ];

      if (!rolesAutorizados.includes(usuario.rol)) {
        throw new BadRequestException(
          'No tienes autorización para reintegrar medicamentos',
        );
      }

      const destino = await tx.bodega.findUnique({
        where: {
          id: data.bodegaDestinoId,
        },
        include: {
          sede: true,
        },
      });

      if (
        !destino ||
        !destino.activa ||
        !destino.sede.activa ||
        !destino.permiteDispensacion ||
        destino.tipo === 'NO_CONFORMES'
      ) {
        throw new BadRequestException(
          'Debes seleccionar una bodega activa que permita dispensación',
        );
      }

      if (!gestion.bodega) {
        throw new ConflictException(
          'La gestión no tiene una bodega de custodia válida',
        );
      }

      if (destino.sedeId !== gestion.bodega.sedeId) {
        throw new BadRequestException(
          'La bodega de destino debe pertenecer a la misma sede',
        );
      }

      if (gestion.origen === 'VENCIMIENTO') {
        throw new ConflictException(
          'Los productos vencidos no pueden reintegrarse al inventario dispensable',
        );
      }

      let lote = gestion.lote;

      if (gestion.origen === 'RECEPCION') {
        const detalle = gestion.detalleActaRecepcion;

        if (!detalle) {
          throw new ConflictException(
            'La gestión no tiene un detalle de recepción asociado',
          );
        }

        if (detalle.resultadoVerificacion !== 'CONFORME') {
          throw new ConflictException(
            'El producto requiere una reevaluación técnica conforme antes del reintegro',
          );
        }

        if (
          detalle.estadoVerificacionInvima !== 'VIGENTE' &&
          detalle.estadoVerificacionInvima !== 'NO_APLICA'
        ) {
          throw new ConflictException(
            'El producto no tiene una verificación INVIMA válida',
          );
        }

        if (destino.sedeId !== detalle.actaRecepcion.sedeId) {
          throw new BadRequestException(
            'La bodega de destino debe pertenecer a la sede del acta',
          );
        }

        if (!lote) {
          lote = await tx.loteInventario.findUnique({
            where: {
              productoInventarioId_numeroLote: {
                productoInventarioId: detalle.productoId,
                numeroLote: detalle.numeroLote,
              },
            },
          });
        }
      } else if (gestion.origen === 'ALMACENAMIENTO') {
        // No se permite liberar automáticamente un producto
        // deteriorado solo porque exista una solicitud de reintegro.
        // Se requiere un flujo de evaluación técnica específico.
        throw new ConflictException(
          'El producto no conforme de almacenamiento requiere una evaluación técnica documentada antes de su reintegro. Esta autorización aún no está implementada',
        );
      }

      if (!lote) {
        throw new NotFoundException(
          'No se encontró el lote asociado a la gestión',
        );
      }

      if (
        lote.fechaVencimiento <= new Date() ||
        lote.estado === 'VENCIDO' ||
        lote.estado === 'BLOQUEADO'
      ) {
        throw new ConflictException(
          'El lote está vencido o bloqueado y no puede reintegrarse',
        );
      }

      const salida = await tx.existenciaInventario.updateMany({
        where: {
          loteId: lote.id,
          bodegaId: gestion.bodegaId,
          cantidad: {
            gte: gestion.cantidad,
          },
        },
        data: {
          cantidad: {
            decrement: gestion.cantidad,
          },
        },
      });

      if (salida.count !== 1) {
        throw new ConflictException(
          'No existe cantidad suficiente en custodia',
        );
      }

      await tx.existenciaInventario.upsert({
        where: {
          loteId_bodegaId: {
            loteId: lote.id,
            bodegaId: data.bodegaDestinoId,
          },
        },
        create: {
          loteId: lote.id,
          bodegaId: data.bodegaDestinoId,
          cantidad: gestion.cantidad,
        },
        update: {
          cantidad: {
            increment: gestion.cantidad,
          },
        },
      });

      const cierre = await tx.gestionNoConforme.updateMany({
        where: {
          id: gestion.id,
          estado: 'EN_CUSTODIA',
        },
        data: {
          estado: 'REINTEGRADO',
          fechaCierre: new Date(),
          responsableId: usuario.id,
          observaciones: data.observaciones?.trim(),
        },
      });

      if (cierre.count !== 1) {
        throw new ConflictException('Esta gestión ya fue cerrada');
      }

      const movimiento = await tx.movimientoInventario.create({
        data: {
          loteId: lote.id,
          tipo: 'TRASLADO',
          cantidad: gestion.cantidad,
          bodegaOrigenId: gestion.bodegaId,
          bodegaDestinoId: data.bodegaDestinoId,
          usuarioId: usuario.id,
          motivo: data.motivo.trim(),
          referencia: `${data.referencia.trim()} / GEST-NC-${gestion.id}`,
        },
      });
      await this.inventoryDocuments.persistAutomaticMovementReceipt(
        tx,
        movimiento.id,
        usuario.id,
      );

      return {
        mensaje: 'Producto reintegrado correctamente',
        gestionId: gestion.id,
        estado: 'REINTEGRADO',
        cantidadReintegrada: gestion.cantidad,
        bodegaDestinoId: data.bodegaDestinoId,
        movimientoId: movimiento.id,
      };
    });
  }
}
