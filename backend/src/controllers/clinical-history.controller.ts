import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

import { ClinicalHistoryService } from '../services/clinical-history.service';

@Controller('clinical-history')
export class ClinicalHistoryController {
  constructor(
    private readonly clinicalHistoryService: ClinicalHistoryService,
  ) {}

  @Get('patient/:patientId')
  getClinicalHistoryByPatientId(
    @Param('patientId', ParseIntPipe) patientId: number,
  ) {
    return this.clinicalHistoryService.getClinicalHistoryByPatientId(patientId);
  }
}
