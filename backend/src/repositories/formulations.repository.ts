import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormulationDto } from '../dto/create-formulation.dto';
import { CreatePatientDiagnosisDto } from '../dto/create-patient-diagnosis.dto';

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

  findActiveDiagnosesByPatient(patientId: number) {
    return this.prisma.diagnosticoPaciente.findMany({
      where: {
        activo: true,
        historiaClinica: {
          pacienteId: patientId,
        },
      },
      orderBy: {
        fechaDiagnostico: 'desc',
      },
      select: {
        id: true,
        historiaClinicaId: true,
        atencionClinicaId: true,
        nombre: true,
        codigoCie10: true,
        tipo: true,
        requiereEsquema: true,
        fechaDiagnostico: true,
        observaciones: true,
        activo: true,
      },
    });
  }

  findDiagnosisByCodeAndPatient(patientId: number, codigoCie10: string) {
    return this.prisma.diagnosticoPaciente.findFirst({
      where: {
        codigoCie10: codigoCie10,
        activo: true,
        historiaClinica: {
          pacienteId: patientId,
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
        historiaClinica: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  createPatientDiagnosis(
    historiaClinicaId: number,
    createPatientDiagnosisDto: CreatePatientDiagnosisDto,
  ) {
    return this.prisma.diagnosticoPaciente.create({
      data: {
        historiaClinicaId,
        atencionClinicaId: createPatientDiagnosisDto.atencionClinicaId,
        nombre: createPatientDiagnosisDto.nombre.trim(),
        codigoCie10:
          createPatientDiagnosisDto.codigoCie10?.trim().toUpperCase() || null,
        tipo: createPatientDiagnosisDto.tipo,
        requiereEsquema: createPatientDiagnosisDto.requiereEsquema ?? false,
        observaciones: createPatientDiagnosisDto.observaciones?.trim() || null,
        activo: true,
      },
      select: {
        id: true,
        historiaClinicaId: true,
        atencionClinicaId: true,
        nombre: true,
        codigoCie10: true,
        tipo: true,
        requiereEsquema: true,
        fechaDiagnostico: true,
        observaciones: true,
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
