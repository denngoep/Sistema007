import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { receiptSnapshot } from '../dispensations/receipt-snapshot';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DispensationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPatientByDocument(numeroDocumento: string) {
    return this.prisma.paciente.findUnique({
      where: { numeroDocumento },

      include: {
        historiaClinica: {
          include: {
            diagnosticosPaciente: {
              where: { activo: true },

              orderBy: { fechaDiagnostico: 'desc' },
            },

            atenciones: {
              orderBy: { fechaAtencion: 'desc' },

              include: {
                profesional: {
                  select: { id: true, nombre: true, rol: true },
                },

                formulaciones: {
                  where: { estado: 'VIGENTE' },

                  orderBy: { fechaFormulacion: 'desc' },

                  include: {
                    diagnosticoPaciente: {
                      select: {
                        id: true,

                        nombre: true,

                        codigoCie10: true,

                        tipo: true,

                        requiereEsquema: true,

                        activo: true,
                      },
                    },

                    medicamentos: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  findFormulationDetail(formulacionId: number, detalleFormulacionId: number) {
    return this.prisma.detalleFormulacion.findFirst({
      where: {
        id: detalleFormulacionId,

        formulacionId,
      },

      include: {
        formulacion: {
          include: {
            atencionClinica: {
              include: {
                historiaClinica: {
                  include: { paciente: true },
                },
              },
            },
          },
        },
      },
    });
  }

  findClinicalMedication(
    medicamento: string,

    concentracion: string | null,

    formaFarmaceutica: string | null,
  ) {
    return this.prisma.medicamento.findFirst({
      where: {
        nombre: medicamento,

        concentracion: concentracion ?? '',

        formaFarmaceutica: formaFarmaceutica ?? '',

        activo: true,
      },
    });
  }

  findDispensableStock(
    medicamentoId: number,

    bodegaId: number,

    fechaActual: Date,
  ) {
    return this.prisma.existenciaInventario.findMany({
      where: {
        bodegaId,

        cantidad: { gt: 0 },

        bodega: {
          activa: true,

          permiteDispensacion: true,

          sede: { activa: true },
        },

        lote: {
          estado: 'DISPONIBLE',

          fechaVencimiento: { gt: fechaActual },

          productoInventario: {
            medicamentoId,

            tipo: 'MEDICAMENTO',

            estado: 'ACTIVO',
          },
        },
      },

      orderBy: [{ lote: { fechaVencimiento: 'asc' } }, { id: 'asc' }],

      include: {
        bodega: { include: { sede: true } },

        lote: {
          include: { productoInventario: true },
        },
      },
    });
  }

  async getDeliveredQuantity(detalleFormulacionId: number) {
    const resultado = await this.prisma.detalleDispensacion.aggregate({
      where: {
        detalleFormulacionId,

        dispensacion: { estado: 'CONFIRMADA' },
      },

      _sum: { cantidadEntregada: true },
    });

    return resultado._sum.cantidadEntregada ?? 0;
  }

  findDispensationForPeriod(
    pacienteId: number,

    detalleFormulacionId: number,

    periodoAnio: number,

    periodoMes: number,
  ) {
    return this.prisma.detalleDispensacion.findFirst({
      where: {
        detalleFormulacionId,

        dispensacion: {
          pacienteId,

          periodoAnio,

          periodoMes,

          estado: 'CONFIRMADA',
        },
      },

      include: {
        dispensacion: {
          include: {
            dispensadoPor: {
              select: {
                id: true,

                nombre: true,

                rol: true,
              },
            },

            bodega: { include: { sede: true } },
          },
        },

        lote: {
          include: { productoInventario: true },
        },

        detalleFormulacion: true,
      },
    });
  }

  findUserById(usuarioId: number) {
    return this.prisma.usuario.findUnique({
      where: { id: usuarioId },

      select: {
        id: true,

        nombre: true,

        rol: true,

        activo: true,
      },
    });
  }

  async createDispensation(
    pacienteId: number,

    detalleFormulacionId: number,

    medicamentoId: number,

    cantidad: number,

    bodegaId: number,

    usuarioId: number,

    periodoAnio: number,

    periodoMes: number,

    observaciones?: string,

    claveIdempotencia?: string,

    hashSolicitud?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
          throw new BadRequestException(
            'La cantidad debe ser un entero mayor que cero',
          );
        }

        if (claveIdempotencia) {
          const prior = await tx.dispensacion.findUnique({
            where: { claveIdempotencia },
          });

          if (prior) {
            if (
              prior.hashSolicitud !== hashSolicitud ||
              prior.dispensadoPorId !== usuarioId
            )
              throw new ConflictException(
                'La clave corresponde a otra solicitud',
              );

            return prior;
          }
        }

        const pacienteActivo = await tx.paciente.findUnique({
          where: { id: pacienteId },
          select: { activo: true },
        });

        if (!pacienteActivo?.activo)
          throw new BadRequestException('Paciente inactivo');

        // Serializar entregas simultáneas del paciente.

        await tx.paciente.update({
          where: { id: pacienteId },

          data: { updatedAt: new Date() },
        });

        // Verificar la formulación dentro de la transacción.

        const detalle = await tx.detalleFormulacion.findUnique({
          where: { id: detalleFormulacionId },

          include: {
            formulacion: {
              include: {
                atencionClinica: {
                  include: {
                    historiaClinica: true,
                  },
                },
              },
            },
          },
        });

        if (
          !detalle ||
          detalle.formulacion.atencionClinica.historiaClinica.pacienteId !==
            pacienteId
        ) {
          throw new BadRequestException(
            'La formulación no corresponde al paciente indicado',
          );
        }

        if (detalle.formulacion.estado !== 'VIGENTE') {
          throw new ConflictException('La formulación no se encuentra vigente');
        }

        const inicio = new Date(detalle.formulacion.fechaFormulacion);

        const vencimiento = new Date(inicio);

        vencimiento.setMonth(
          vencimiento.getMonth() + detalle.formulacion.vigenciaMeses,
        );

        if (new Date() >= vencimiento) {
          throw new ConflictException(
            'La vigencia de la formulación ya finalizó',
          );
        }

        // Verificar correspondencia con catálogo clínico.

        const medicamento = await tx.medicamento.findFirst({
          where: {
            id: medicamentoId,

            nombre: detalle.medicamento,

            concentracion: detalle.concentracion ?? '',

            formaFarmaceutica: detalle.formaFarmaceutica ?? '',

            activo: true,
          },
        });

        if (!medicamento) {
          throw new BadRequestException(
            'El medicamento no corresponde a la formulación o está inactivo',
          );
        }

        // Validar al responsable.

        const usuario = await tx.usuario.findUnique({
          where: { id: usuarioId },

          select: {
            activo: true,

            rol: true,
          },
        });

        if (
          !usuario?.activo ||
          ![
            'REGENTE_FARMACIA',

            'AUXILIAR_FARMACIA',

            'QUIMICO_FARMACEUTICO',
          ].includes(usuario.rol)
        ) {
          throw new BadRequestException('Usuario no autorizado para dispensar');
        }

        // Sumar todas las entregas confirmadas.

        const entregas = await tx.detalleDispensacion.aggregate({
          where: {
            detalleFormulacionId,

            dispensacion: {
              estado: 'CONFIRMADA',
            },
          },

          _sum: {
            cantidadEntregada: true,
          },
        });

        const cantidadEntregada = entregas._sum.cantidadEntregada ?? 0;

        const saldo = detalle.cantidad - cantidadEntregada;

        if (saldo <= 0) {
          throw new ConflictException({
            codigo: 'FORMULACION_COMPLETAMENTE_DISPENSADA',

            mensaje: 'La cantidad prescrita ya fue entregada completamente',

            cantidadFormulada: detalle.cantidad,

            cantidadEntregada,

            cantidadPendiente: 0,
          });
        }

        if (cantidad > saldo) {
          throw new ConflictException({
            codigo: 'CANTIDAD_SUPERA_PENDIENTE',

            mensaje: `Solo quedan ${saldo} unidades pendientes`,

            cantidadFormulada: detalle.cantidad,

            cantidadEntregada,

            cantidadPendiente: saldo,
          });
        }

        // Consultar existencias disponibles por FEFO.

        const existencias = await tx.existenciaInventario.findMany({
          where: {
            bodegaId,

            cantidad: { gt: 0 },

            bodega: {
              activa: true,

              permiteDispensacion: true,

              sede: { activa: true },
            },

            lote: {
              estado: 'DISPONIBLE',

              fechaVencimiento: {
                gt: new Date(),
              },

              productoInventario: {
                medicamentoId,

                tipo: 'MEDICAMENTO',

                estado: 'ACTIVO',
              },
            },
          },

          orderBy: [{ lote: { fechaVencimiento: 'asc' } }, { id: 'asc' }],

          include: {
            lote: {
              include: {
                productoInventario: true,
              },
            },
          },
        });

        const stockDisponible = existencias.reduce(
          (total, existencia) => total + existencia.cantidad,

          0,
        );

        if (stockDisponible < cantidad) {
          throw new ConflictException(
            'El inventario cambió y no hay existencias suficientes',
          );
        }

        const ahora = new Date();

        const numeroDispensacion =
          `DISP-${ahora.getFullYear()}` +
          `${String(ahora.getMonth() + 1).padStart(2, '0')}` +
          `${String(ahora.getDate()).padStart(2, '0')}` +
          `-${pacienteId}-${Date.now()}-` +
          `${Math.floor(Math.random() * 10000)

            .toString()

            .padStart(4, '0')}`;

        // Crear cabecera de dispensación.

        const dispensacion = await tx.dispensacion.create({
          data: {
            numeroDispensacion,

            claveIdempotencia,

            hashSolicitud,

            pacienteId,

            bodegaId,

            dispensadoPorId: usuarioId,

            periodoAnio,

            periodoMes,

            estado: 'PENDIENTE',

            observaciones,
          },
        });

        let cantidadPendiente = cantidad;

        for (const existencia of existencias) {
          if (cantidadPendiente <= 0) {
            break;
          }

          const cantidadDelLote = Math.min(
            existencia.cantidad,

            cantidadPendiente,
          );

          // Descontar solo si existe cantidad suficiente.

          const actualizacion = await tx.existenciaInventario.updateMany({
            where: {
              id: existencia.id,

              cantidad: {
                gte: cantidadDelLote,
              },
            },

            data: {
              cantidad: {
                decrement: cantidadDelLote,
              },
            },
          });

          if (actualizacion.count !== 1) {
            throw new ConflictException(
              'El inventario fue modificado durante la dispensación. Intente nuevamente',
            );
          }

          // Registrar el lote entregado.

          await tx.detalleDispensacion.create({
            data: {
              dispensacionId: dispensacion.id,

              detalleFormulacionId,

              loteId: existencia.loteId,

              cantidadEntregada: cantidadDelLote,
            },
          });

          // Registrar movimiento de inventario.

          await tx.movimientoInventario.create({
            data: {
              loteId: existencia.loteId,

              tipo: 'DISPENSACION',

              cantidad: cantidadDelLote,

              bodegaOrigenId: bodegaId,

              usuarioId,

              dispensacionId: dispensacion.id,

              motivo: 'Dispensación de medicamento a paciente',

              referencia: numeroDispensacion,
            },
          });

          cantidadPendiente -= cantidadDelLote;
        }

        if (cantidadPendiente > 0) {
          throw new ConflictException(
            'No fue posible completar la cantidad solicitada',
          );
        }

        // Confirmar solamente cuando toda la operación

        // haya sido registrada correctamente.

        const confirmed = await tx.dispensacion.update({
          where: {
            id: dispensacion.id,
          },

          data: {
            estado: 'CONFIRMADA',
          },

          include: {
            paciente: {
              select: {
                id: true,

                tipoDocumento: true,

                numeroDocumento: true,

                nombres: true,

                apellidos: true,
              },
            },

            bodega: {
              include: { sede: true },
            },

            dispensadoPor: {
              select: {
                id: true,

                nombre: true,

                rol: true,
              },
            },

            detalles: {
              include: {
                lote: {
                  include: {
                    productoInventario: true,
                  },
                },

                detalleFormulacion: {
                  include: {
                    formulacion: { include: { atencionClinica: true } },
                  },
                },
              },
            },

            movimientos: true,
          },
        });

        const numeroComprobante = `COMP-${confirmed.id}`;

        const fechaComprobante = new Date();

        const datosComprobante = receiptSnapshot({
          ...confirmed,
          numeroComprobante,
          fechaComprobante,
        });

        return tx.dispensacion.update({
          where: { id: confirmed.id },
          data: { numeroComprobante, fechaComprobante, datosComprobante },
        });
      },

      {
        isolationLevel: 'Serializable',

        maxWait: 10000,

        timeout: 15000,
      },
    );
  }

  findByKey(claveIdempotencia: string) {
    return this.prisma.dispensacion.findUnique({
      where: { claveIdempotencia },
    });
  }

  findDispensationById(dispensacionId: number) {
    return this.prisma.dispensacion.findUnique({
      where: { id: dispensacionId },

      include: {
        paciente: true,

        bodega: {
          include: { sede: true },
        },

        dispensadoPor: {
          select: {
            id: true,

            nombre: true,

            rol: true,
          },
        },

        detalles: {
          include: {
            lote: {
              include: {
                productoInventario: true,
              },
            },

            detalleFormulacion: {
              include: {
                formulacion: {
                  include: {
                    atencionClinica: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  generateReceipt(
    dispensacionId: number,

    numeroComprobante: string,

    fechaComprobante: Date,
  ) {
    return this.prisma.dispensacion.update({
      where: { id: dispensacionId },

      data: {
        numeroComprobante,

        fechaComprobante,
      },

      include: {
        paciente: true,

        bodega: {
          include: { sede: true },
        },

        dispensadoPor: {
          select: {
            id: true,

            nombre: true,

            rol: true,
          },
        },

        detalles: {
          include: {
            lote: {
              include: {
                productoInventario: true,
              },
            },

            detalleFormulacion: {
              include: {
                formulacion: {
                  include: {
                    atencionClinica: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  registerDigitalSignature(
    dispensacionId: number,

    firmaPaciente: string,

    fechaFirma: Date,
  ) {
    return this.prisma.dispensacion.update({
      where: { id: dispensacionId },

      data: {
        tipoFirma: 'DIGITAL',

        firmaPaciente,

        soporteFirmado: null,

        fechaFirma,

        fechaCargaSoporte: null,
      },

      include: {
        paciente: true,

        bodega: {
          include: { sede: true },
        },

        dispensadoPor: {
          select: {
            id: true,

            nombre: true,

            rol: true,
          },
        },
      },
    });
  }

  registerManualSignatureSupport(
    dispensacionId: number,

    soporteFirmado: string,

    fechaFirma: Date,

    fechaCargaSoporte: Date,
  ) {
    return this.prisma.dispensacion.update({
      where: { id: dispensacionId },

      data: {
        tipoFirma: 'MANUAL',

        firmaPaciente: null,

        soporteFirmado,

        fechaFirma,

        fechaCargaSoporte,
      },

      include: {
        paciente: true,

        bodega: {
          include: { sede: true },
        },

        dispensadoPor: {
          select: {
            id: true,

            nombre: true,

            rol: true,
          },
        },
      },
    });
  }
}
