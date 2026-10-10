import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import { CreateFormulationDto } from '../dto/create-formulation.dto';
import { CreatePatientDiagnosisDto } from '../dto/create-patient-diagnosis.dto';
import { FormulationsService } from '../services/formulations.service';

@Controller('formulations')
export class FormulationsController {
  constructor(private readonly formulationsService: FormulationsService) {}

  @Post()
  createFormulation(@Body() createFormulationDto: CreateFormulationDto) {
    return this.formulationsService.createFormulation(createFormulationDto);
  }

  @Post('diagnoses')
  createPatientDiagnosis(
    @Body() createPatientDiagnosisDto: CreatePatientDiagnosisDto,
  ) {
    return this.formulationsService.createPatientDiagnosis(
      createPatientDiagnosisDto,
    );
  }

  @Get('patient/:patientId/diagnoses')
  getActiveDiagnosesByPatient(
    @Param('patientId', ParseIntPipe) patientId: number,
  ) {
    return this.formulationsService.getActiveDiagnosesByPatient(patientId);
  }

  @Get('patient/:patientId/active')
  getActiveFormulationsByPatient(
    @Param('patientId', ParseIntPipe) patientId: number,
  ) {
    return this.formulationsService.getActiveFormulationsByPatient(patientId);
  }
}
