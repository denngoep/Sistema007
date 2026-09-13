/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormulationDto } from '../dto/create-formulation.dto';

@Injectable()
export class FormulationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findClinicalCareById(atencionClinicaId: number) {
    return this.prisma.atencionClinica.findUnique({
      where: {
        id: atencionClinicaId,
      },
      include: {
        historiaClinica: {
          include: {
            paciente: true,
          },
        },
        profesional: {
          select: {
            id: true,
            nombre: true,
            correo: true,
            rol: true,
            activo: true,
          },
        },
      },
    });
  }

  create(createFormulationDto: CreateFormulationDto) {
    return this.prisma.formulacion.create({
      data: {
        atencionClinicaId: createFormulationDto.atencionClinicaId,
        vigenciaMeses: createFormulationDto.vigenciaMeses,
        indicaciones: createFormulationDto.indicaciones,
        medicamentos: {
          create: createFormulationDto.medicamentos.map((medicamento) => ({
            medicamento: medicamento.medicamento,
            concentracion: medicamento.concentracion,
            formaFarmaceutica: medicamento.formaFarmaceutica,
            dosis: medicamento.dosis,
            frecuencia: medicamento.frecuencia,
            duracion: medicamento.duracion,
            cantidad: medicamento.cantidad,
            viaAdministracion: medicamento.viaAdministracion,
            observaciones: medicamento.observaciones,
          })),
        },
      },
      include: {
        atencionClinica: {
          include: {
            historiaClinica: {
              include: {
                paciente: true,
              },
            },
            profesional: {
              select: {
                id: true,
                nombre: true,
                correo: true,
                rol: true,
                activo: true,
              },
            },
          },
        },
        medicamentos: true,
      },
    });
  }
}
