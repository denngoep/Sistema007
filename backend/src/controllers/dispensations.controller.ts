import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { ValidateDispensationDto } from '../dto/validate-dispensation.dto';
import { DispensationsService } from '../services/dispensations.service';

@Controller('dispensations')
export class DispensationsController {
  constructor(private readonly dispensationsService: DispensationsService) {}

  @Get('patient/:numeroDocumento/medications')
  getMedicationsToDispense(@Param('numeroDocumento') numeroDocumento: string) {
    return this.dispensationsService.getMedicationsToDispense(numeroDocumento);
  }

  @Post('validate')
  validateDispensation(@Body() dto: ValidateDispensationDto) {
    return this.dispensationsService.validateDispensation(dto);
  }
}
