import { Module } from '@nestjs/common';
import { ClinicalHistoryController } from '../controllers/clinical-history.controller';
import { ClinicalHistoryService } from '../services/clinical-history.service';
import { ClinicalHistoryRepository } from '../repositories/clinical-history.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClinicalHistoryController],
  providers: [ClinicalHistoryService, ClinicalHistoryRepository],
})
export class ClinicalHistoryModule {}
