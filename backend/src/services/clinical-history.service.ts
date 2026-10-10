import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ClinicalHistoryRepository } from '../repositories/clinical-history.repository';
import { CreateClinicalAttentionDto } from '../dto/create-clinical-attention.dto';

@Injectable()
export class ClinicalHistoryService {
  constructor(
    private readonly clinicalHistoryRepository: ClinicalHistoryRepository,
  ) {}

  async getClinicalHistoryByPatientId(pacienteId: number) {
    const clinicalHistory =
      await this.clinicalHistoryRepository.findByPatientId(pacienteId);

    if (!clinicalHistory) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!clinicalHistory.historiaClinica) {
      throw new NotFoundException(
        'El paciente no tiene una historia clínica registrada',
      );
    }

    return clinicalHistory;
  }

  async createClinicalAttention(
    createClinicalAttentionDto: CreateClinicalAttentionDto,
  ) {
    const {
      pacienteId,
      profesionalId,
      motivoConsulta,
      evolucion,
      diagnostico,
      observaciones,
    } = createClinicalAttentionDto;

    const clinicalHistory =
      await this.clinicalHistoryRepository.findByPatientId(pacienteId);

    if (!clinicalHistory) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!clinicalHistory.historiaClinica) {
      throw new NotFoundException(
        'El paciente no tiene una historia clínica registrada',
      );
    }

    const professional =
      await this.clinicalHistoryRepository.findProfessionalById(profesionalId);

    if (!professional) {
      throw new NotFoundException('Profesional no encontrado');
    }

    if (!professional.activo) {
      throw new BadRequestException('El profesional se encuentra inactivo');
    }

    // Buscar la última atención clínica registrada.
    const lastAttention =
      await this.clinicalHistoryRepository.findLastClinicalAttention();

    let nextAdmissionNumber = 1;

    /*
     * Permite continuar el consecutivo aunque existan
     * registros antiguos como:
     *
     * ING-2026-001
     * ING-2026-002
     *
     * También funciona con el nuevo formato:
     *
     * 00003
     * 00004
     */
    if (lastAttention) {
      const match = lastAttention.numeroIngreso.match(/(\d+)$/);

      if (match) {
        const lastNumber = Number.parseInt(match[1], 10);

        if (!Number.isNaN(lastNumber)) {
          nextAdmissionNumber = lastNumber + 1;
        }
      }
    }

    // Convertir el consecutivo al formato de 5 dígitos.
    // Ejemplo: 3 -> 00003
    const numeroIngreso = nextAdmissionNumber.toString().padStart(5, '0');

    // Validación adicional para evitar números duplicados.
    const existingAttention =
      await this.clinicalHistoryRepository.findAttentionByAdmissionNumber(
        numeroIngreso,
      );

    if (existingAttention) {
      throw new BadRequestException(
        'Ya existe una atención clínica con este número de ingreso',
      );
    }

    const attention =
      await this.clinicalHistoryRepository.createClinicalAttention(
        clinicalHistory.historiaClinica.id,
        profesionalId,
        numeroIngreso,
        motivoConsulta,
        evolucion,
        diagnostico,
        observaciones,
      );

    return {
      message: 'Atención clínica registrada correctamente',
      numeroIngreso,
      atencionClinica: attention,
    };
  }
}
