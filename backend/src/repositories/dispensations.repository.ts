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
}
