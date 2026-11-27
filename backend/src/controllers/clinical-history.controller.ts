import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { ClinicalHistoryService } from '../services/clinical-history.service';
import { CreateClinicalAttentionDto } from '../dto/create-clinical-attention.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClinicalEncounterDto } from '../dto/create-clinical-encounter.dto';
import { ClinicalEncounterService } from '../services/clinical-encounter.service';
import { hasFunctionalTestAccess } from '../testing/functional-test-access.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub: number;
    email: string;
    nombre: string;
  };
};

@Controller('clinical-history')
@UseGuards(JwtAuthGuard)
export class ClinicalHistoryController {
  constructor(
    private readonly clinicalHistoryService: ClinicalHistoryService,
    private readonly prisma: PrismaService,
    private readonly clinicalEncounterService: ClinicalEncounterService,
  ) {}

  private async requireClinicalAccess(
    request: AuthenticatedRequest,
    allowedRoles: string[],
  ): Promise<number> {
    const usuarioId = request.user?.sub;

    if (!Number.isInteger(usuarioId) || !usuarioId || usuarioId <= 0) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        activo: true,
        rol: true,
      },
    });

    if (!usuario || !usuario.activo) {
      throw new ForbiddenException('Usuario inactivo o sin autorización');
    }

    if (
      !allowedRoles.includes(usuario.rol) &&
      !(await hasFunctionalTestAccess(this.prisma, usuarioId))
    ) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a esta información clínica',
      );
    }

    return usuarioId;
  }

  @Get('patient/:patientId')
  async getClinicalHistoryByPatientId(
    @Req() request: AuthenticatedRequest,
    @Param('patientId', ParseIntPipe) patientId: number,
  ) {
    // El administrador puede supervisar información clínica, pero no registrar
    // actuaciones. La responsabilidad profesional se conserva en los POST.
    await this.requireClinicalAccess(request, [
      'ADMINISTRADOR',
      'MEDICO',
      'ENFERMERO',
    ]);

    return this.clinicalHistoryService.getClinicalHistoryByPatientId(patientId);
  }

  @Post('attentions')
  async createClinicalAttention(
    @Req() request: AuthenticatedRequest,
    @Body() createClinicalAttentionDto: CreateClinicalAttentionDto,
  ) {
    const profesionalId = await this.requireClinicalAccess(request, ['MEDICO']);

    return this.clinicalHistoryService.createClinicalAttention(
      createClinicalAttentionDto,
      profesionalId,
    );
  }

  @Post('encounters')
  async createClinicalEncounter(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateClinicalEncounterDto,
  ) {
    const profesionalId = await this.requireClinicalAccess(request, ['MEDICO']);
    return this.clinicalEncounterService.create(dto, profesionalId);
  }
}
