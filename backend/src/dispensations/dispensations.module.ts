import { Module } from '@nestjs/common';

import { DispensationsController } from '../controllers/dispensations.controller';
import { DispensationsRepository } from '../repositories/dispensations.repository';
import { DispensationsService } from '../services/dispensations.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DispensationsController],
  providers: [DispensationsService, DispensationsRepository],
  exports: [DispensationsService],
})
export class DispensationsModule {}
