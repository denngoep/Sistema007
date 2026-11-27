import { UpdateUserScopeDto } from '../dto/update-user-scope.dto';
import { requireManager } from '../users/user-management.policy';
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

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { hasFunctionalTestAccess } from '../testing/functional-test-access.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub: number;
    email: string;
    nombre: string;
  };
};

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  private async requireUserManager(
    request: AuthenticatedRequest,
  ): Promise<number> {
    const usuarioId = request.user?.sub;

    if (!Number.isInteger(usuarioId) || !usuarioId || usuarioId <= 0) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        servicioId: true,
        esCoordinador: true,
        servicio: {
          select: { id: true, codigo: true, nombre: true, activo: true },
        },
        activo: true,
        rol: true,
      },
    });

    if (!usuario || !usuario.activo) {
      throw new ForbiddenException('Usuario inactivo o sin autorización');
    }

    requireManager(usuario);
    return usuarioId;
  }

  @Get('permissions')
  async getPermissions(@Req() request: AuthenticatedRequest) {
    const userId = request.user?.sub ?? 0;
    const permissions = await this.usersService.getPermissions(userId);
    return {
      ...permissions,
      functionalTestAccess: await hasFunctionalTestAccess(this.prisma, userId),
    };
  }

  @Patch(':id/scope')
  async updateScope(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserScopeDto,
  ) {
    const actorId = await this.requireUserManager(request);
    return this.usersService.updateUserScope(id, dto, actorId);
  }

  @Get()
  async getUsers(@Req() request: AuthenticatedRequest) {
    const actorId = await this.requireUserManager(request);
    return this.usersService.getUsers(actorId);
  }

  @Get('search')
  async searchUsers(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    const actorId = await this.requireUserManager(request);
    return this.usersService.searchUsers(actorId, query);
  }

  @Get(':id')
  async getUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const actorId = await this.requireUserManager(request);
    return this.usersService.getUser(id, actorId);
  }

  @Patch(':id/status')
  async updateUserStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
  ) {
    const actorId = await this.requireUserManager(request);

    return this.usersService.updateUserStatus(id, updateUserStatusDto, actorId);
  }

  @Patch(':id')
  async updateUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const actorId = await this.requireUserManager(request);

    return this.usersService.updateUser(id, updateUserDto, actorId);
  }

  @Post()
  async createUser(
    @Req() request: AuthenticatedRequest,
    @Body() createUserDto: CreateUserDto,
  ) {
    const actorId = await this.requireUserManager(request);

    return this.usersService.createUser(createUserDto, actorId);
  }
}
