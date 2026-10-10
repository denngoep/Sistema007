import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import { ClinicalHistoryService } from '../services/clinical-history.service';
import { CreateClinicalAttentionDto } from '../dto/create-clinical-attention.dto';

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

  @Post('attentions')
  createClinicalAttention(
    @Body() createClinicalAttentionDto: CreateClinicalAttentionDto,
  ) {
    return this.clinicalHistoryService.createClinicalAttention(
      createClinicalAttentionDto,
    );
  }
}
