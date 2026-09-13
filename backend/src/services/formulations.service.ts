/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateFormulationDto } from '../dto/create-formulation.dto';
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
