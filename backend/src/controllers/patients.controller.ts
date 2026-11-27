import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { PatientsService } from '../services/patients.service';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { UpdatePatientDto } from '../dto/update-patient.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '../generated/prisma/enums';
import { hasFunctionalTestAccess } from '../testing/functional-test-access.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub: number;
    email: string;
    nombre: string;
  };
};

const CONSULTATION_ROLES: RolUsuario[] = [
  'ADMINISTRADOR',
  'MEDICO',
  'ENFERMERO',
  'AUXILIAR_ENFERMERIA',
  'RECEPCION_ADMISIONES',
  'REGENTE_FARMACIA',
  'AUXILIAR_FARMACIA',
  'QUIMICO_FARMACEUTICO',
];

const MANAGEMENT_ROLES: RolUsuario[] = [
  'ADMINISTRADOR',
  'RECEPCION_ADMISIONES',
];

@Controller('patients')
@UseGuards(JwtAuthGuard)
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly prisma: PrismaService,
  ) {}

  private async requirePatientAccess(
    request: AuthenticatedRequest,
    allowedRoles: RolUsuario[],
  ): Promise<void> {
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
        'No tienes permisos para realizar esta operación sobre pacientes',
      );
    }
  }

  @Get()
  async getPatients(@Req() request: AuthenticatedRequest) {
    await this.requirePatientAccess(request, CONSULTATION_ROLES);

    return this.patientsService.getPatients();
  }

  @Get('search')
  async searchPatients(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    await this.requirePatientAccess(request, CONSULTATION_ROLES);
    return this.patientsService.searchPatients(query);
  }

  @Patch(':id')
  async updatePatient(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePatientDto: UpdatePatientDto,
  ) {
    await this.requirePatientAccess(request, MANAGEMENT_ROLES);

    return this.patientsService.updatePatient(id, updatePatientDto);
  }

  @Post()
  async createPatient(
    @Req() request: AuthenticatedRequest,
    @Body() createPatientDto: CreatePatientDto,
  ) {
    await this.requirePatientAccess(request, MANAGEMENT_ROLES);

    return this.patientsService.createPatient(createPatientDto);
  }
}
