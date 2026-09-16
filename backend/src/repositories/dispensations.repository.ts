import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DispensationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPatientByDocument(numeroDocumento: string) {
    return this.prisma.paciente.findUnique({
      where: {
        numeroDocumento,
      },
      include: {
        historiaClinica: {
          include: {
            diagnosticosPaciente: {
              where: {
                activo: true,
              },
              orderBy: {
                fechaDiagnostico: 'desc',
              },
            },
            atenciones: {
              orderBy: {
                fechaAtencion: 'desc',
              },
              include: {
                profesional: {
                  select: {
                    id: true,
                    nombre: true,
                    rol: true,
                  },
                },
                formulaciones: {
                  where: {
                    estado: 'VIGENTE',
                  },
                  orderBy: {
                    fechaFormulacion: 'desc',
                  },
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
                  include: {
                    paciente: true,
                  },
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
        cantidad: {
          gt: 0,
        },
        bodega: {
          activa: true,
          permiteDispensacion: true,
        },
        lote: {
          estado: 'DISPONIBLE',
          fechaVencimiento: {
            gt: fechaActual,
          },
          productoInventario: {
            medicamentoId,
            tipo: 'MEDICAMENTO',
            estado: 'ACTIVO',
          },
        },
      },
      orderBy: {
        lote: {
          fechaVencimiento: 'asc',
        },
      },
      include: {
        bodega: {
          include: {
            sede: true,
          },
        },
        lote: {
          include: {
            productoInventario: true,
          },
        },
      },
    });
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
            bodega: {
              include: {
                sede: true,
              },
            },
          },
        },
        lote: {
          include: {
            productoInventario: true,
          },
        },
        detalleFormulacion: true,
      },
    });
  }

  findUserById(usuarioId: number) {
    return this.prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },
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
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existencias = await tx.existenciaInventario.findMany({
        where: {
          bodegaId,
          cantidad: {
            gt: 0,
          },
          bodega: {
            activa: true,
            permiteDispensacion: true,
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
        orderBy: {
          lote: {
            fechaVencimiento: 'asc',
          },
        },
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
        throw new Error(
          'El inventario cambió y ya no existe stock suficiente para realizar la dispensación.',
        );
      }

      const ahora = new Date();

      const numeroDispensacion = `DISP-${ahora.getFullYear()}${String(
        ahora.getMonth() + 1,
      ).padStart(2, '0')}${String(ahora.getDate()).padStart(
        2,
        '0',
      )}-${pacienteId}-${Date.now()}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')}`;

      const dispensacion = await tx.dispensacion.create({
        data: {
          numeroDispensacion,
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
          throw new Error(
            'El inventario fue modificado durante la dispensación. Intente nuevamente.',
          );
        }

        await tx.detalleDispensacion.create({
          data: {
            dispensacionId: dispensacion.id,
            detalleFormulacionId,
            loteId: existencia.loteId,
            cantidadEntregada: cantidadDelLote,
          },
        });

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
        throw new Error('No fue posible completar la cantidad solicitada.');
      }

      return tx.dispensacion.update({
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
            },
          },
          bodega: {
            include: {
              sede: true,
            },
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
              detalleFormulacion: true,
            },
          },
          movimientos: true,
        },
      });
    });
  }

  // HU-026 y HU-027:
  // consultar una dispensación con la información necesaria
  // para el comprobante y la evidencia de recepción.
  findDispensationById(dispensacionId: number) {
    return this.prisma.dispensacion.findUnique({
      where: {
        id: dispensacionId,
      },
      include: {
        paciente: true,
        bodega: {
          include: {
            sede: true,
          },
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
            detalleFormulacion: true,
          },
        },
      },
    });
  }

  // HU-026 - Registrar número y fecha del comprobante.
  generateReceipt(
    dispensacionId: number,
    numeroComprobante: string,
    fechaComprobante: Date,
  ) {
    return this.prisma.dispensacion.update({
      where: {
        id: dispensacionId,
      },
      data: {
        numeroComprobante,
        fechaComprobante,
      },
      include: {
        paciente: true,
        bodega: {
          include: {
            sede: true,
          },
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
            detalleFormulacion: true,
          },
        },
      },
    });
  }

  // HU-027 - Registrar firma digital capturada directamente
  // durante la entrega del medicamento.
  registerDigitalSignature(
    dispensacionId: number,
    firmaPaciente: string,
    fechaFirma: Date,
  ) {
    return this.prisma.dispensacion.update({
      where: {
        id: dispensacionId,
      },
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
          include: {
            sede: true,
          },
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

  // HU-027 - Registrar el soporte de contingencia firmado
  // físicamente por el paciente y cargado posteriormente.
  registerManualSignatureSupport(
    dispensacionId: number,
    soporteFirmado: string,
    fechaFirma: Date,
    fechaCargaSoporte: Date,
  ) {
    return this.prisma.dispensacion.update({
      where: {
        id: dispensacionId,
      },
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
          include: {
            sede: true,
          },
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
