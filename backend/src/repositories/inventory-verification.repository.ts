import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  EstadoVerificacionInvima,
  ResultadoVerificacionIngreso,
  TipoCambioVerificacionRecepcion,
} from '../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface EditReceiptVerificationData {
  detalleActaId: number;
  usuarioId: number;
  estadoVerificacionInvima: EstadoVerificacionInvima;
  temperaturaRegistrada: number | null;
  humedadRegistrada: number | null;
  observaciones: string | null;
  motivo: string;
  referencia: string;
}

@Injectable()
export class InventoryVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async editReceiptVerification(data: EditReceiptVerificationData) {
    if (
      !Number.isInteger(data.detalleActaId) ||
      data.detalleActaId <= 0 ||
      !Number.isInteger(data.usuarioId) ||
      data.usuarioId <= 0
    ) {
      throw new BadRequestException(
        'El producto y el responsable deben ser válidos',
      );
    }

    const motivo = data.motivo?.trim();
    const referencia = data.referencia?.trim();

    if (!motivo || !referencia) {
      throw new BadRequestException(
        'Debes registrar el motivo y la referencia de la corrección',
      );
    }

    if (
      !Object.values(EstadoVerificacionInvima).includes(
        data.estadoVerificacionInvima,
      )
    ) {
      throw new BadRequestException('El estado INVIMA no es válido');
    }

    if (
      data.temperaturaRegistrada !== null &&
      !Number.isFinite(data.temperaturaRegistrada)
    ) {
      throw new BadRequestException('La temperatura registrada no es válida');
    }

    if (
      data.humedadRegistrada !== null &&
      (!Number.isFinite(data.humedadRegistrada) ||
        data.humedadRegistrada < 0 ||
        data.humedadRegistrada > 100)
    ) {
      throw new BadRequestException('La humedad debe estar entre 0 y 100 %');
    }

    if (data.observaciones !== null && typeof data.observaciones !== 'string') {
      throw new BadRequestException('Las observaciones no son válidas');
    }

    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id: data.usuarioId },
      });

      if (
        !usuario ||
        !usuario.activo ||
        !['ADMINISTRADOR', 'QUIMICO_FARMACEUTICO', 'REGENTE_FARMACIA'].includes(
          usuario.rol,
        )
      ) {
        throw new ForbiddenException(
          'El usuario no está autorizado para corregir verificaciones',
        );
      }

      const detalle = await tx.detalleActaRecepcion.findUnique({
        where: { id: data.detalleActaId },
        include: {
          actaRecepcion: true,
          producto: true,
        },
      });

      if (!detalle) {
        throw new NotFoundException(
          'No se encontró el producto de la recepción',
        );
      }

      if (detalle.actaRecepcion.estado === 'ANULADA') {
        throw new ConflictException(
          'No se puede modificar una recepción anulada',
        );
      }

      if (
        detalle.resultadoVerificacion === ResultadoVerificacionIngreso.PENDIENTE
      ) {
        throw new ConflictException(
          'El producto debe completar primero su revisión inicial',
        );
      }

      const observacionesNuevas = data.observaciones?.trim() || null;

      const huboCambios =
        detalle.estadoVerificacionInvima !== data.estadoVerificacionInvima ||
        detalle.temperaturaRegistrada !== data.temperaturaRegistrada ||
        detalle.humedadRegistrada !== data.humedadRegistrada ||
        (detalle.observaciones ?? null) !== observacionesNuevas;

      if (!huboCambios) {
        throw new BadRequestException(
          'No hay cambios documentales para registrar',
        );
      }

      // Un producto conforme no puede quedar con datos
      // incompatibles con su verificación técnica.
      if (
        detalle.resultadoVerificacion === ResultadoVerificacionIngreso.CONFORME
      ) {
        if (
          data.estadoVerificacionInvima ===
            EstadoVerificacionInvima.PENDIENTE ||
          data.estadoVerificacionInvima === EstadoVerificacionInvima.NO_VIGENTE
        ) {
          throw new BadRequestException(
            'Un producto conforme requiere verificación INVIMA válida',
          );
        }

        if (
          detalle.producto.tipo === 'MEDICAMENTO' &&
          data.estadoVerificacionInvima !== EstadoVerificacionInvima.VIGENTE
        ) {
          throw new BadRequestException(
            'Un medicamento conforme requiere INVIMA vigente',
          );
        }

        if (
          detalle.producto.condicionConservacion === 'CADENA_FRIO' &&
          data.temperaturaRegistrada === null
        ) {
          throw new BadRequestException(
            'El producto requiere temperatura registrada',
          );
        }

        if (
          data.temperaturaRegistrada !== null &&
          ((detalle.producto.temperaturaMinima !== null &&
            data.temperaturaRegistrada < detalle.producto.temperaturaMinima) ||
            (detalle.producto.temperaturaMaxima !== null &&
              data.temperaturaRegistrada > detalle.producto.temperaturaMaxima))
        ) {
          throw new BadRequestException(
            'La temperatura corregida está fuera del rango permitido',
          );
        }

        if (
          data.humedadRegistrada !== null &&
          detalle.producto.humedadMaxima !== null &&
          data.humedadRegistrada > detalle.producto.humedadMaxima
        ) {
          throw new BadRequestException(
            'La humedad corregida supera el límite permitido',
          );
        }
      }

      const actualizado = await tx.detalleActaRecepcion.updateMany({
        where: {
          id: detalle.id,
          updatedAt: detalle.updatedAt,
          resultadoVerificacion: detalle.resultadoVerificacion,
        },
        data: {
          estadoVerificacionInvima: data.estadoVerificacionInvima,
          temperaturaRegistrada: data.temperaturaRegistrada,
          humedadRegistrada: data.humedadRegistrada,
          observaciones: observacionesNuevas,
        },
      });

      if (actualizado.count !== 1) {
        throw new ConflictException(
          'El producto fue modificado por otra operación. Actualiza la recepción',
        );
      }

      const auditoria = await tx.reevaluacionTecnicaRecepcion.create({
        data: {
          detalleActaRecepcionId: detalle.id,
          responsableId: usuario.id,

          tipoCambio: TipoCambioVerificacionRecepcion.CORRECCION_DOCUMENTAL,

          resultadoAnterior: detalle.resultadoVerificacion,
          resultadoNuevo: detalle.resultadoVerificacion,

          estadoInvimaAnterior: detalle.estadoVerificacionInvima,
          estadoInvimaNuevo: data.estadoVerificacionInvima,

          temperaturaAnterior: detalle.temperaturaRegistrada,
          temperaturaNueva: data.temperaturaRegistrada,

          humedadAnterior: detalle.humedadRegistrada,
          humedadNueva: data.humedadRegistrada,

          observacionesAnteriores: detalle.observaciones,
          observacionesNuevas,

          motivo,
          referencia,
          observaciones: 'Corrección documental de verificación técnica',
        },
      });

      return {
        mensaje: 'Corrección documental registrada correctamente',
        detalleActaId: detalle.id,
        numeroLote: detalle.numeroLote,
        resultadoVerificacion: detalle.resultadoVerificacion,
        auditoriaId: auditoria.id,
        responsableId: usuario.id,
        existenciasModificadas: false,
      };
    });
  }
}
