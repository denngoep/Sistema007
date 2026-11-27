import { Module } from '@nestjs/common';

import { PatientsController } from '../controllers/patients.controller';
import { PatientsService } from '../services/patients.service';
import { PatientsRepository } from '../repositories/patients.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientsRepository],
})
export class PatientsModule {}
