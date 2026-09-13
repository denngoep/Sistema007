/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateFormulationDto } from '../dto/create-formulation.dto';
import { FormulationsRepository } from '../repositories/formulations.repository';

@Injectable()
export class FormulationsService {
  constructor(
    private readonly formulationsRepository: FormulationsRepository,
  ) {}

  async createFormulation(createFormulationDto: CreateFormulationDto) {
    const clinicalCare = await this.formulationsRepository.findClinicalCareById(
      createFormulationDto.atencionClinicaId,
    );

    if (!clinicalCare) {
      throw new NotFoundException('La atención clínica indicada no existe');
    }

    return this.formulationsRepository.create(createFormulationDto);
  }
}
