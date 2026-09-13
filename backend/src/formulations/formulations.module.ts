import { Module } from '@nestjs/common';

import { FormulationsController } from '../controllers/formulations.controller';
import { FormulationsService } from '../services/formulations.service';
import { FormulationsRepository } from '../repositories/formulations.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FormulationsController],
  providers: [FormulationsService, FormulationsRepository],
})
export class FormulationsModule {}
