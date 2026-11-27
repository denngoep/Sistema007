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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '../generated/prisma/enums';

import { CreateFormulationDto } from '../dto/create-formulation.dto';
import { CreatePatientDiagnosisDto } from '../dto/create-patient-diagnosis.dto';
import { FormulationsService } from '../services/formulations.service';
import { hasFunctionalTestAccess } from '../testing/functional-test-access.service';

type AuthenticatedRequest = Request & { user?: { sub: number } };

// Same clinical responsibilities as the existing clinical-history routes.
const READ_ROLES: RolUsuario[] = ['ADMINISTRADOR', 'MEDICO', 'ENFERMERO'];
const WRITE_ROLES: RolUsuario[] = ['MEDICO'];

@Controller('formulations')
@UseGuards(JwtAuthGuard)
export class FormulationsController {
  constructor(
    private readonly formulationsService: FormulationsService,
    private readonly prisma: PrismaService,
  ) {}

  private async requireClinicalAccess(
    request: AuthenticatedRequest,
    allowedRoles: RolUsuario[],
  ): Promise<void> {
    const usuarioId = request.user?.sub;

    if (!usuarioId || !Number.isInteger(usuarioId) || usuarioId <= 0) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { activo: true, rol: true },
    });

    if (
      !usuario?.activo ||
      (!allowedRoles.includes(usuario.rol) &&
        !(await hasFunctionalTestAccess(this.prisma, usuarioId)))
    ) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta operación clínica',
      );
    }
  }

  @Post()
  async createFormulation(
    @Req() request: AuthenticatedRequest,
    @Body() createFormulationDto: CreateFormulationDto,
  ) {
    await this.requireClinicalAccess(request, WRITE_ROLES);
    return this.formulationsService.createFormulation(createFormulationDto);
  }

  @Post('diagnoses')
  async createPatientDiagnosis(
    @Req() request: AuthenticatedRequest,
    @Body() createPatientDiagnosisDto: CreatePatientDiagnosisDto,
  ) {
    await this.requireClinicalAccess(request, WRITE_ROLES);
    return this.formulationsService.createPatientDiagnosis(
      createPatientDiagnosisDto,
    );
  }

  @Get('patient/:patientId/diagnoses')
  async getActiveDiagnosesByPatient(
    @Req() request: AuthenticatedRequest,
    @Param('patientId', ParseIntPipe) patientId: number,
  ) {
    await this.requireClinicalAccess(request, READ_ROLES);
    return this.formulationsService.getActiveDiagnosesByPatient(patientId);
  }

  @Get('patient/:patientId/active')
  async getActiveFormulationsByPatient(
    @Req() request: AuthenticatedRequest,
    @Param('patientId', ParseIntPipe) patientId: number,
  ) {
    await this.requireClinicalAccess(request, READ_ROLES);
    return this.formulationsService.getActiveFormulationsByPatient(patientId);
  }
}
