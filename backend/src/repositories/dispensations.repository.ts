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
}
