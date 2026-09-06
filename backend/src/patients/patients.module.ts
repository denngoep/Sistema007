import { Module } from '@nestjs/common';

import { PatientsController } from '../controllers/patients.controller';
import { PatientsService } from '../services/patients.service';
import { PatientsRepository } from '../repositories/patients.repository';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, PatientsRepository],
})
export class PatientsModule {}
