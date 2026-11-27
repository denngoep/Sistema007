import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CreateClinicalEncounterDto } from '../dto/create-clinical-encounter.dto';
import { ClinicalHistoryRepository } from '../repositories/clinical-history.repository';
import { ClinicalHistoryService } from './clinical-history.service';
import { FormulationsService } from './formulations.service';

@Injectable()
export class ClinicalEncounterService {
  constructor(
    private readonly repository: ClinicalHistoryRepository,
    private readonly clinicalHistory: ClinicalHistoryService,
    private readonly formulations: FormulationsService,
  ) {}

  async create(dto: CreateClinicalEncounterDto, profesionalId: number) {
    if (!!dto.nuevoDiagnostico === !!dto.diagnosticoPacienteId) {
      throw new BadRequestException(
        'Seleccione un diagnóstico existente o registre uno nuevo, exclusivamente.',
      );
    }

    // Retry only transactions Prisma has rolled back for a serialization conflict.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.repository.transaction(async (tx) => {
          const attention = await this.clinicalHistory.createClinicalAttention(
            dto,
            profesionalId,
            tx,
          );
          const diagnosis = dto.nuevoDiagnostico
            ? (
                await this.formulations.createPatientDiagnosis(
                  {
                    ...dto.nuevoDiagnostico,
                    pacienteId: dto.pacienteId,
                    atencionClinicaId: attention.atencionClinica.id,
                  },
                  tx,
                )
              ).diagnostico
            : undefined;
          const formulation = await this.formulations.createFormulation(
            {
              ...dto.formulacion,
              atencionClinicaId: attention.atencionClinica.id,
              diagnosticoPacienteId: diagnosis?.id ?? dto.diagnosticoPacienteId,
            },
            tx,
          );
          return {
            ...attention,
            message:
              'Atención, diagnóstico y formulación registrados correctamente',
            diagnosticoPacienteId: formulation.diagnosticoPacienteId,
            formulacion: formulation,
          };
        });
      } catch (error: unknown) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? error.code
            : undefined;
        if (code === 'P2034' && attempt < 2) continue;
        if (code === 'P2034' || code === 'P2002') {
          throw new ConflictException(
            'Otro registro concurrente impidió guardar la atención completa. No se guardaron cambios de esta solicitud; vuelva a intentarlo.',
          );
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo completar la transacción clínica');
  }
}
