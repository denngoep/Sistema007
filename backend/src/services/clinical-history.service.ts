import { Injectable, NotFoundException } from '@nestjs/common';
import { ClinicalHistoryRepository } from '../repositories/clinical-history.repository';

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
}
