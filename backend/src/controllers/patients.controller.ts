import { Body, Controller, Post } from '@nestjs/common';

import { PatientsService } from '../services/patients.service';
import { CreatePatientDto } from '../dto/create-patient.dto';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  createPatient(@Body() createPatientDto: CreatePatientDto) {
    return this.patientsService.createPatient(createPatientDto);
  }
}
