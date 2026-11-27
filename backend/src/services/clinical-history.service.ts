import type { Prisma } from '../generated/prisma/client';
import {
  BadRequestException,
  ForbiddenException,
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
    profesionalId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const {
      pacienteId,
      motivoConsulta,
      evolucion,
      diagnostico,
      observaciones,
    } = createClinicalAttentionDto;

    if (!Number.isSafeInteger(profesionalId) || profesionalId <= 0) {
      throw new ForbiddenException(
        'No se pudo identificar al profesional autenticado',
      );
    }

    const clinicalHistory =
      await this.clinicalHistoryRepository.findByPatientId(pacienteId, tx);

    if (!clinicalHistory) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!clinicalHistory.historiaClinica) {
      throw new NotFoundException(
        'El paciente no tiene una historia clínica registrada',
      );
    }

    if (!clinicalHistory.paciente.activo) {
      throw new BadRequestException('El paciente se encuentra inactivo');
    }

    const professional =
      await this.clinicalHistoryRepository.findProfessionalById(
        profesionalId,
        tx,
      );

    if (!professional) {
      throw new NotFoundException('Profesional no encontrado');
    }

    if (!professional.activo || professional.rol !== 'MEDICO') {
      throw new ForbiddenException(
        'El profesional debe estar activo y autorizado como médico',
      );
    }

    // Buscar la última atención clínica registrada.
    const lastAttention =
      await this.clinicalHistoryRepository.findLastClinicalAttention(tx);

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
        tx,
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
        tx,
      );

    return {
      message: 'Atención clínica registrada correctamente',
      numeroIngreso,
      atencionClinica: attention,
    };
  }
}
