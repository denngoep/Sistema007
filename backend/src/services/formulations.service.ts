import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateFormulationDto } from '../dto/create-formulation.dto';
import { CreatePatientDiagnosisDto } from '../dto/create-patient-diagnosis.dto';
import { FormulationsRepository } from '../repositories/formulations.repository';

@Injectable()
export class FormulationsService {
  constructor(
    private readonly formulationsRepository: FormulationsRepository,
  ) {}

  async createFormulation(createFormulationDto: CreateFormulationDto) {
    const clinicalCare = await this.formulationsRepository.findClinicalCareById(
      createFormulationDto.atencionClinicaId,
    );

    if (!clinicalCare) {
      throw new NotFoundException('La atención clínica indicada no existe');
    }

    if (createFormulationDto.diagnosticoPacienteId) {
      const diagnosis = await this.formulationsRepository.findDiagnosisById(
        createFormulationDto.diagnosticoPacienteId,
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

    return this.formulationsRepository.create(createFormulationDto);
  }

  async createPatientDiagnosis(
    createPatientDiagnosisDto: CreatePatientDiagnosisDto,
  ) {
    const patient = await this.formulationsRepository.findPatientById(
      createPatientDiagnosisDto.pacienteId,
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
