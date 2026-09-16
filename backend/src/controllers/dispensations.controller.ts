import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import { CreateDispensationDto } from '../dto/create-dispensation.dto';
import { RegisterDispensationSignatureDto } from '../dto/register-dispensation-signature.dto';
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

  // HU-026 - Generar comprobante de dispensación.
  @Post(':id/receipt')
  generateReceipt(@Param('id', ParseIntPipe) dispensacionId: number) {
    return this.dispensationsService.generateReceipt(dispensacionId);
  }

  // HU-027 - Registrar firma del paciente como evidencia de la dispensación.
  @Post(':id/signature')
  registerSignature(
    @Param('id', ParseIntPipe) dispensacionId: number,
    @Body() dto: RegisterDispensationSignatureDto,
  ) {
    return this.dispensationsService.registerSignature(dispensacionId, dto);
  }
}
