import type { Prisma } from '../generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClinicalHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(work, { isolationLevel: 'Serializable' });
  }

  async findByPatientId(pacienteId: number, tx?: Prisma.TransactionClient) {
    const paciente = await (tx ?? this.prisma).paciente.findUnique({
      where: {
        id: pacienteId,
      },
      include: {
        historiaClinica: {
          include: {
            atenciones: {
              include: {
                profesional: {
                  select: {
                    id: true,
                    nombre: true,
                    rol: true,
                  },
                },
                diagnosticosPaciente: {
                  select: {
                    id: true,
                    codigoCie10: true,
                    nombre: true,
                    tipo: true,
                    observaciones: true,
                  },
                },
                formulaciones: {
                  include: {
                    diagnosticoPaciente: {
                      select: { codigoCie10: true, nombre: true },
                    },
                    medicamentos: {
                      select: {
                        id: true,
                        medicamento: true,
                        concentracion: true,
                        formaFarmaceutica: true,
                        dosis: true,
                        frecuencia: true,
                        duracion: true,
                        cantidad: true,
                        viaAdministracion: true,
                        observaciones: true,
                      },
                    },
                  },
                  orderBy: { fechaFormulacion: 'desc' },
                },
              },
              orderBy: {
                fechaAtencion: 'desc',
              },
            },
          },
        },
      },
    });

    if (!paciente) {
      return null;
    }

    return {
      paciente: {
        id: paciente.id,
        tipoDocumento: paciente.tipoDocumento,
        numeroDocumento: paciente.numeroDocumento,
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        fechaNacimiento: paciente.fechaNacimiento,
        telefono: paciente.telefono,
        correo: paciente.correo,
        activo: paciente.activo,
      },
      historiaClinica: paciente.historiaClinica,
    };
  }

  async createClinicalAttention(
    historiaClinicaId: number,
    profesionalId: number,
    numeroIngreso: string,
    motivoConsulta?: string,
    evolucion?: string,
    diagnostico?: string,
    observaciones?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).atencionClinica.create({
      data: {
        historiaClinicaId,
        profesionalId,
        numeroIngreso,
        motivoConsulta,
        evolucion,
        diagnostico,
        observaciones,
      },
      include: {
        profesional: {
          select: {
            id: true,
            nombre: true,
            rol: true,
          },
        },
      },
    });
  }

  async findProfessionalById(
    profesionalId: number,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).usuario.findUnique({
      where: {
        id: profesionalId,
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
      },
    });
  }

  async findAttentionByAdmissionNumber(
    numeroIngreso: string,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).atencionClinica.findUnique({
      where: {
        numeroIngreso,
      },
    });
  }

  async findLastClinicalAttention(tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).atencionClinica.findFirst({
      orderBy: {
        id: 'desc',
      },
      select: {
        id: true,
        numeroIngreso: true,
      },
    });
  }
}
