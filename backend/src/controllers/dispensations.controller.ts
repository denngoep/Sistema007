import { Controller, Get, Param } from '@nestjs/common';

import { DispensationsService } from '../services/dispensations.service';

@Controller('dispensations')
export class DispensationsController {
  constructor(private readonly dispensationsService: DispensationsService) {}

  @Get('patient/:numeroDocumento/medications')
  getMedicationsToDispense(@Param('numeroDocumento') numeroDocumento: string) {
    return this.dispensationsService.getMedicationsToDispense(numeroDocumento);
  }
}
