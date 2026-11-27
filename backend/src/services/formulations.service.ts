import type { Prisma } from '../generated/prisma/client';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateFormulationDto } from '../dto/create-formulation.dto';
import { CreatePatientDiagnosisDto } from '../dto/create-patient-diagnosis.dto';
import { FormulationsRepository } from '../repositories/formulations.repository';
import { validateMedication } from '../formulations/medication-validation';

@Injectable()
export class FormulationsService {
  constructor(
    private readonly formulationsRepository: FormulationsRepository,
  ) {}

  async createFormulation(
    createFormulationDto: CreateFormulationDto,
    tx?: Prisma.TransactionClient,
  ) {
    if (
      !Array.isArray(createFormulationDto.medicamentos) ||
      !createFormulationDto.medicamentos.length
    ) {
      throw new BadRequestException(
        'La formulación debe incluir al menos un medicamento',
      );
    }
    const validations = createFormulationDto.medicamentos.map(
      (medication, index) => {
        const result = validateMedication(
          medication,
          createFormulationDto.indicaciones,
        );
        return {
          errors: result.errors.map(
            (message) => `Medicamento ${index + 1}: ${message}`,
          ),
          warnings: result.warnings.map(
            (message) => `Medicamento ${index + 1}: ${message}`,
          ),
        };
      },
    );
    const errors = validations.flatMap((result) => result.errors);
    if (errors.length) {
      throw new BadRequestException({
        message: errors,
        codigo: 'FORMULACION_INCONSISTENTE',
      });
    }
    const clinicalCare = await this.formulationsRepository.findClinicalCareById(
      createFormulationDto.atencionClinicaId,
      tx,
    );

    if (!clinicalCare) {
      throw new NotFoundException('La atención clínica indicada no existe');
    }

    if (!clinicalCare.historiaClinica.paciente.activo) {
      throw new BadRequestException('El paciente se encuentra inactivo');
    }

    if (createFormulationDto.diagnosticoPacienteId) {
      const diagnosis = await this.formulationsRepository.findDiagnosisById(
        createFormulationDto.diagnosticoPacienteId,
        tx,
      );

      if (!diagnosis) {
        throw new NotFoundException('El diagnóstico indicado no existe');
      }

      if (diagnosis.historiaClinicaId !== clinicalCare.historiaClinicaId) {
        throw new BadRequestException(
          'El diagnóstico no pertenece a la historia clínica del paciente',
        );
      }

      if (!diagnosis.activo) {
        throw new BadRequestException(
          'El diagnóstico indicado no se encuentra activo',
        );
      }

      if (diagnosis.requiereEsquema) {
        const activeScheme = diagnosis.esquemas[0];

        if (!activeScheme) {
          throw new BadRequestException(
            'El diagnóstico requiere un esquema de tratamiento activo',
          );
        }

        const formulatedMedications = createFormulationDto.medicamentos.map(
          (medication) => medication.medicamento.trim().toLowerCase(),
        );

        const authorizedMedications = activeScheme.medicamentos.map(
          (medication) => medication.medicamento.trim().toLowerCase(),
        );

        const unauthorizedMedications = formulatedMedications.filter(
          (medication) => !authorizedMedications.includes(medication),
        );

        if (unauthorizedMedications.length > 0) {
          throw new BadRequestException(
            `La formulación contiene medicamentos que no corresponden al esquema de tratamiento autorizado: ${unauthorizedMedications.join(', ')}`,
          );
        }
      }
    }

    const formulation = await this.formulationsRepository.create(
      createFormulationDto,
      tx,
    );
    return {
      ...formulation,
      advertenciasValidacion: validations.flatMap((result) => result.warnings),
    };
  }

  async createPatientDiagnosis(
    createPatientDiagnosisDto: CreatePatientDiagnosisDto,
    tx?: Prisma.TransactionClient,
  ) {
    const patient = await this.formulationsRepository.findPatientById(
      createPatientDiagnosisDto.pacienteId,
      tx,
    );

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!patient.activo) {
      throw new BadRequestException('El paciente se encuentra inactivo');
    }

    if (!patient.historiaClinica) {
      throw new NotFoundException(
        'El paciente no tiene una historia clínica registrada',
      );
    }

    if (createPatientDiagnosisDto.atencionClinicaId) {
      const clinicalCare =
        await this.formulationsRepository.findClinicalCareById(
          createPatientDiagnosisDto.atencionClinicaId,
          tx,
        );

      if (!clinicalCare) {
        throw new NotFoundException('La atención clínica indicada no existe');
      }

      if (clinicalCare.historiaClinicaId !== patient.historiaClinica.id) {
        throw new BadRequestException(
          'La atención clínica no pertenece al paciente indicado',
        );
      }
    }

    const nombre = createPatientDiagnosisDto.nombre.trim();

    if (!nombre) {
      throw new BadRequestException('El nombre del diagnóstico es obligatorio');
    }

    const codigoCie10 = createPatientDiagnosisDto.codigoCie10
      ?.trim()
      .toUpperCase();

    if (codigoCie10) {
      const existingDiagnosis =
        await this.formulationsRepository.findDiagnosisByCodeAndPatient(
          createPatientDiagnosisDto.pacienteId,
          codigoCie10,
          tx,
        );

      if (existingDiagnosis) {
        throw new BadRequestException(
          'El paciente ya tiene registrado un diagnóstico activo con este código CIE-10',
        );
      }
    }

    const diagnosis = await this.formulationsRepository.createPatientDiagnosis(
      patient.historiaClinica.id,
      {
        ...createPatientDiagnosisDto,
        nombre,
        codigoCie10,
      },
      tx,
    );

    return {
      message: 'Diagnóstico registrado correctamente',
      diagnostico: diagnosis,
    };
  }

  async getActiveDiagnosesByPatient(patientId: number) {
    const patient =
      await this.formulationsRepository.findPatientById(patientId);

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    const diagnoses =
      await this.formulationsRepository.findActiveDiagnosesByPatient(patientId);

    return {
      paciente: patient,
      totalDiagnosticos: diagnoses.length,
      diagnosticos: diagnoses,
    };
  }

  async getActiveFormulationsByPatient(patientId: number) {
    const patient =
      await this.formulationsRepository.findPatientById(patientId);

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    const formulations =
      await this.formulationsRepository.findActiveFormulationsByPatient(
        patientId,
      );

    const now = new Date();

    const activeFormulations = formulations
      .map((formulation) => {
        const expirationDate = new Date(formulation.fechaFormulacion);

        expirationDate.setMonth(
          expirationDate.getMonth() + formulation.vigenciaMeses,
        );

        return {
          ...formulation,
          fechaVencimiento: expirationDate,
        };
      })
      .filter((formulation) => formulation.fechaVencimiento >= now);

    return {
      paciente: patient,
      totalFormulacionesVigentes: activeFormulations.length,
      formulaciones: activeFormulations,
    };
  }
}
