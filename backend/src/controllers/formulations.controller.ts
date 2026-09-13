import { Body, Controller, Post } from '@nestjs/common';

import { CreateFormulationDto } from '../dto/create-formulation.dto';
import { FormulationsService } from '../services/formulations.service';

@Controller('formulations')
export class FormulationsController {
  constructor(private readonly formulationsService: FormulationsService) {}

  @Post()
  createFormulation(@Body() createFormulationDto: CreateFormulationDto) {
    return this.formulationsService.createFormulation(createFormulationDto);
  }
}
