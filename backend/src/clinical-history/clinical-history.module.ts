import { Module } from '@nestjs/common';

import { ClinicalHistoryController } from '../controllers/clinical-history.controller';
import { ClinicalHistoryService } from '../services/clinical-history.service';
import { ClinicalHistoryRepository } from '../repositories/clinical-history.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FormulationsModule } from '../formulations/formulations.module';
import { ClinicalEncounterService } from '../services/clinical-encounter.service';

@Module({
  imports: [PrismaModule, AuthModule, FormulationsModule],
  controllers: [ClinicalHistoryController],
  providers: [
    ClinicalHistoryService,
    ClinicalHistoryRepository,
    ClinicalEncounterService,
  ],
})
export class ClinicalHistoryModule {}
