/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormulationDto } from '../dto/create-formulation.dto';

@Injectable()
export class FormulationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findClinicalCareById(atencionClinicaId: number) {
    return this.prisma.atencionClinica.findUnique({
      where: {
        id: atencionClinicaId,
      },
      include: {
        historiaClinica: {
          include: {
            paciente: true,
          },
        },
        profesional: {
          select: {
            id: true,
            nombre: true,
            correo: true,
            rol: true,
            activo: true,
          },
        },
      },
    });
  }

  findDiagnosisById(diagnosticoPacienteId: number) {
    return this.prisma.diagnosticoPaciente.findUnique({
      where: {
        id: diagnosticoPacienteId,
      },
      include: {
        esquemas: {
          where: {
            estado: 'ACTIVO',
          },
          orderBy: {
            fechaInicio: 'desc',
          },
          take: 1,
          include: {
            medicamentos: true,
          },
        },
      },
    });
  }

  findPatientById(patientId: number) {
    return this.prisma.paciente.findUnique({
      where: {
        id: patientId,
      },
      select: {
        id: true,
        tipoDocumento: true,
        numeroDocumento: true,
        nombres: true,
        apellidos: true,
        activo: true,
      },
    });
  }

  findActiveFormulationsByPatient(patientId: number) {
    return this.prisma.formulacion.findMany({
      where: {
        estado: 'VIGENTE',
        atencionClinica: {
          historiaClinica: {
            pacienteId: patientId,
          },
        },
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
          },
        },
        medicamentos: true,
        atencionClinica: {
          select: {
            id: true,
            numeroIngreso: true,
            fechaAtencion: true,
            profesional: {
              select: {
                id: true,
                nombre: true,
                rol: true,
              },
            },
          },
        },
      },
    });
  }

  create(createFormulationDto: CreateFormulationDto) {
    return this.prisma.formulacion.create({
      data: {
        atencionClinicaId: createFormulationDto.atencionClinicaId,
        diagnosticoPacienteId: createFormulationDto.diagnosticoPacienteId,
        vigenciaMeses: createFormulationDto.vigenciaMeses,
        indicaciones: createFormulationDto.indicaciones,
        medicamentos: {
          create: createFormulationDto.medicamentos.map((medicamento) => ({
            medicamento: medicamento.medicamento,
            concentracion: medicamento.concentracion,
            formaFarmaceutica: medicamento.formaFarmaceutica,
            dosis: medicamento.dosis,
            frecuencia: medicamento.frecuencia,
            duracion: medicamento.duracion,
            cantidad: medicamento.cantidad,
            viaAdministracion: medicamento.viaAdministracion,
            observaciones: medicamento.observaciones,
          })),
        },
      },
      include: {
        atencionClinica: {
          include: {
            historiaClinica: {
              include: {
                paciente: true,
              },
            },
            profesional: {
              select: {
                id: true,
                nombre: true,
                correo: true,
                rol: true,
                activo: true,
              },
            },
          },
        },
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
    });
  }
}
