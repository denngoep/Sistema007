import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  EstadoGestionNoConforme,
  RolUsuario,
} from '../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface CorrectInventoryReceiptDetailData {
  detalleActaId: number;
  usuarioId: number;
  numeroLote?: string;
  fechaVencimiento?: string;
  cantidadRecibida?: number;
  motivo: string;
  referencia: string;
}

@Injectable()
export class InventoryReceiptCorrectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async correctReceiptDetail(data: CorrectInventoryReceiptDetailData) {
    if (!Number.isInteger(data.detalleActaId) || data.detalleActaId <= 0) {
      throw new BadRequestException(
        'El identificador del detalle de recepción no es válido',
      );
    }

    if (!Number.isInteger(data.usuarioId) || data.usuarioId <= 0) {
      throw new BadRequestException(
        'No se pudo identificar al usuario responsable',
      );
    }

    const motivo = data.motivo?.trim();
    const referencia = data.referencia?.trim();

    if (!motivo || !referencia) {
      throw new BadRequestException(
        'El motivo y la referencia de corrección son obligatorios',
      );
    }

    if (
      data.numeroLote === undefined &&
      data.fechaVencimiento === undefined &&
      data.cantidadRecibida === undefined
    ) {
      throw new BadRequestException(
        'Debes indicar al menos un dato para corregir',
      );
    }

    if (
      data.numeroLote !== undefined &&
      (typeof data.numeroLote !== 'string' || !data.numeroLote.trim())
    ) {
      throw new BadRequestException('El número de lote no puede estar vacío');
    }

    if (
      data.cantidadRecibida !== undefined &&
      (!Number.isInteger(data.cantidadRecibida) || data.cantidadRecibida <= 0)
    ) {
      throw new BadRequestException(
        'La cantidad recibida debe ser un número entero mayor que cero',
      );
    }

    let fechaVencimientoNueva: Date | undefined;

    if (data.fechaVencimiento !== undefined) {
      if (
        typeof data.fechaVencimiento !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.fechaVencimiento)
      ) {
        throw new BadRequestException(
          'La fecha de vencimiento debe tener formato AAAA-MM-DD',
        );
      }

      fechaVencimientoNueva = new Date(
        `${data.fechaVencimiento}T00:00:00.000Z`,
      );

      if (
        Number.isNaN(fechaVencimientoNueva.getTime()) ||
        fechaVencimientoNueva.toISOString().slice(0, 10) !==
          data.fechaVencimiento
      ) {
        throw new BadRequestException('La fecha de vencimiento no es válida');
      }
    }

    return this.prisma.$transaction(
      async (tx) => {
        const usuario = await tx.usuario.findUnique({
          where: { id: data.usuarioId },
          select: {
            id: true,
            activo: true,
            rol: true,
          },
        });

        if (!usuario || !usuario.activo) {
          throw new ForbiddenException(
            'El usuario responsable no existe o está inactivo',
          );
        }

        const rolesAutorizados: RolUsuario[] = [
          RolUsuario.ADMINISTRADOR,
          RolUsuario.REGENTE_FARMACIA,
          RolUsuario.QUIMICO_FARMACEUTICO,
        ];

        if (!rolesAutorizados.includes(usuario.rol)) {
          throw new ForbiddenException(
            'No tienes autorización para corregir datos de recepción',
          );
        }

        const detalle = await tx.detalleActaRecepcion.findUnique({
          where: { id: data.detalleActaId },
          include: {
            actaRecepcion: true,
            detalleIngreso: true,
            gestionNoConforme: true,
          },
        });

        if (!detalle) {
          throw new NotFoundException(
            'No existe el detalle de recepción indicado',
          );
        }

        if (detalle.actaRecepcion.estado === 'ANULADA') {
          throw new ConflictException(
            'No se pueden corregir datos de una recepción anulada',
          );
        }

        const numeroLoteNuevo = data.numeroLote?.trim() ?? detalle.numeroLote;

        const vencimientoNuevo =
          fechaVencimientoNueva ?? detalle.fechaVencimiento;

        const cantidadNueva = data.cantidadRecibida ?? detalle.cantidadRecibida;

        const cambiaLote = numeroLoteNuevo !== detalle.numeroLote;

        const cambiaVencimiento =
          vencimientoNuevo.getTime() !== detalle.fechaVencimiento.getTime();

        const cambiaCantidad = cantidadNueva !== detalle.cantidadRecibida;

        if (!cambiaLote && !cambiaVencimiento && !cambiaCantidad) {
          throw new BadRequestException(
            'Los datos indicados son iguales a los registrados',
          );
        }

        const ingreso = detalle.detalleIngreso;

        if (ingreso && cambiaCantidad) {
          throw new ConflictException(
            'La cantidad ya fue ingresada al inventario. No se permite modificar directamente la recepción; debe gestionarse mediante un ajuste de inventario autorizado y documentado',
          );
        }

        const gestion = detalle.gestionNoConforme;

        if (gestion && cambiaCantidad) {
          if (gestion.estado !== EstadoGestionNoConforme.PENDIENTE) {
            throw new ConflictException(
              'La cantidad no puede modificarse porque el producto ya tiene una gestión de no conformidad en curso o finalizada',
            );
          }

          throw new ConflictException(
            'La cantidad no puede modificarse directamente mientras exista una gestión de producto no conforme. Primero debe resolverse su situación documental',
          );
        }

        if (ingreso && (cambiaLote || cambiaVencimiento)) {
          const lote = await tx.loteInventario.findUnique({
            where: { id: ingreso.loteId },
          });

          if (!lote) {
            throw new ConflictException(
              'No se encontró el lote asociado al ingreso de inventario',
            );
          }

          if (
            lote.productoInventarioId !== detalle.productoId ||
            lote.numeroLote !== detalle.numeroLote ||
            lote.fechaVencimiento.getTime() !==
              detalle.fechaVencimiento.getTime()
          ) {
            throw new ConflictException(
              'Los datos del acta y del lote de inventario no coinciden. Se requiere revisión antes de corregirlos',
            );
          }

          const ingresosAsociados = await tx.detalleIngresoInventario.count({
            where: { loteId: lote.id },
          });

          if (ingresosAsociados !== 1) {
            throw new ConflictException(
              'El lote está asociado a varios ingresos. No se permite modificarlo directamente porque afectaría otras recepciones',
            );
          }

          const dispensacionesAsociadas = await tx.detalleDispensacion.count({
            where: { loteId: lote.id },
          });

          if (dispensacionesAsociadas > 0) {
            throw new ConflictException(
              'El lote tiene registros de dispensación. No se permite modificar directamente su identificación o vencimiento',
            );
          }

          const movimientos = await tx.movimientoInventario.findMany({
            where: { loteId: lote.id },
            select: {
              id: true,
              tipo: true,
              ingresoInventarioId: true,
            },
          });

          const movimientosPosteriores = movimientos.filter(
            (movimiento) =>
              movimiento.tipo !== 'INGRESO' ||
              movimiento.ingresoInventarioId !== ingreso.ingresoInventarioId,
          );

          if (movimientosPosteriores.length > 0) {
            throw new ConflictException(
              'El lote tiene movimientos adicionales al ingreso original. La corrección requiere un procedimiento controlado para preservar la trazabilidad',
            );
          }

          if (
            movimientos.filter((movimiento) => movimiento.tipo === 'INGRESO')
              .length !== 1
          ) {
            throw new ConflictException(
              'No se pudo verificar un único movimiento de ingreso para el lote',
            );
          }

          const loteDuplicado = await tx.loteInventario.findFirst({
            where: {
              productoInventarioId: detalle.productoId,
              numeroLote: numeroLoteNuevo,
              id: { not: lote.id },
            },
            select: { id: true },
          });

          if (loteDuplicado) {
            throw new ConflictException(
              'Ya existe otro lote de este producto con el número indicado',
            );
          }

          const actualizacionLote = await tx.loteInventario.updateMany({
            where: {
              id: lote.id,
              updatedAt: lote.updatedAt,
            },
            data: {
              numeroLote: numeroLoteNuevo,
              fechaVencimiento: vencimientoNuevo,
            },
          });

          if (actualizacionLote.count !== 1) {
            throw new ConflictException(
              'El lote fue modificado por otro proceso. Consulta nuevamente la recepción',
            );
          }
        }

        const actualizacionDetalle = await tx.detalleActaRecepcion.updateMany({
          where: {
            id: detalle.id,
            updatedAt: detalle.updatedAt,
          },
          data: {
            numeroLote: numeroLoteNuevo,
            fechaVencimiento: vencimientoNuevo,
            cantidadRecibida: cantidadNueva,
          },
        });

        if (actualizacionDetalle.count !== 1) {
          throw new ConflictException(
            'La recepción fue modificada por otro proceso. Actualiza la información e inténtalo nuevamente',
          );
        }

        const auditoria = await tx.correccionDetalleRecepcion.create({
          data: {
            detalleActaRecepcionId: detalle.id,
            responsableId: usuario.id,

            numeroLoteAnterior: detalle.numeroLote,
            numeroLoteNuevo,

            fechaVencimientoAnterior: detalle.fechaVencimiento,
            fechaVencimientoNueva: vencimientoNuevo,

            cantidadRecibidaAnterior: detalle.cantidadRecibida,
            cantidadRecibidaNueva: cantidadNueva,

            motivo,
            referencia,
          },
        });

        return {
          mensaje: 'Los datos de recepción fueron corregidos correctamente',
          detalleActaRecepcionId: detalle.id,
          actaRecepcionId: detalle.actaRecepcionId,
          correccionId: auditoria.id,

          datosAnteriores: {
            numeroLote: detalle.numeroLote,
            fechaVencimiento: detalle.fechaVencimiento,
            cantidadRecibida: detalle.cantidadRecibida,
          },

          datosNuevos: {
            numeroLote: numeroLoteNuevo,
            fechaVencimiento: vencimientoNuevo,
            cantidadRecibida: cantidadNueva,
          },

          responsableId: usuario.id,
          motivo,
          referencia,
          fechaCorreccion: auditoria.fechaCorreccion,

          existenciasModificadas: false,
        };
      },
      {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }
}
