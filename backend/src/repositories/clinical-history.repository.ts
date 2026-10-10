import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClinicalHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPatientId(pacienteId: number) {
    const paciente = await this.prisma.paciente.findUnique({
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
  ) {
    return this.prisma.atencionClinica.create({
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

  async findProfessionalById(profesionalId: number) {
    return this.prisma.usuario.findUnique({
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

  async findAttentionByAdmissionNumber(numeroIngreso: string) {
    return this.prisma.atencionClinica.findUnique({
      where: {
        numeroIngreso,
      },
    });
  }

  async findLastClinicalAttention() {
    return this.prisma.atencionClinica.findFirst({
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
