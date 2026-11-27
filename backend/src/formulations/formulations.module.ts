import { Module } from '@nestjs/common';

import { FormulationsController } from '../controllers/formulations.controller';
import { FormulationsService } from '../services/formulations.service';
import { FormulationsRepository } from '../repositories/formulations.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FormulationsController],
  providers: [FormulationsService, FormulationsRepository],
  exports: [FormulationsService],
})
export class FormulationsModule {}
