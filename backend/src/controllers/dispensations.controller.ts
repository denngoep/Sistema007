import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateDispensationDto } from '../dto/create-dispensation.dto';
import { ValidateDispensationDto } from '../dto/validate-dispensation.dto';
import { DispensationsService } from '../services/dispensations.service';

@Controller('dispensations')
export class DispensationsController {
  constructor(private readonly dispensationsService: DispensationsService) {}

  // HU-022 - Consultar medicamentos a dispensar.
  @Get('patient/:numeroDocumento/medications')
  getMedicationsToDispense(@Param('numeroDocumento') numeroDocumento: string) {
    return this.dispensationsService.getMedicationsToDispense(numeroDocumento);
  }

  // HU-023 y HU-024 - Validar entrega y evitar doble dispensación.
  @Post('validate')
  validateDispensation(@Body() dto: ValidateDispensationDto) {
    return this.dispensationsService.validateDispensation(dto);
  }

  // HU-025 - Registrar dispensación.
  @Post()
  createDispensation(@Body() dto: CreateDispensationDto) {
    return this.dispensationsService.createDispensation(dto);
  }
}
