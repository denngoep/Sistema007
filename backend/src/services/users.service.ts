import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Prisma } from '../generated/prisma/client';
import { RolUsuario } from '../generated/prisma/enums';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { UpdateUserScopeDto } from '../dto/update-user-scope.dto';
import {
  managementPermissions,
  requireManager,
  requireManagedTarget,
  SERVICE_ROLES,
} from '../users/user-management.policy';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  private async actor(id: number, tx?: Prisma.TransactionClient) {
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new UnauthorizedException('Usuario no autenticado');
    const actor = await this.usersRepository.findActor(id, tx);
    if (!actor) throw new ForbiddenException('Usuario no autorizado');
    if (!actor.activo) throw new ForbiddenException('Usuario inactivo');
    return actor;
  }

  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.usersRepository.transaction(work);
      } catch (error: unknown) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? error.code
            : undefined;
        if (code === 'P2034' && attempt < 2) continue;
        if (code === 'P2034')
          throw new ConflictException(
            'El alcance cambió durante la operación. Vuelve a intentarlo.',
          );
        if (code === 'P2002')
          throw new ConflictException('El correo ya se encuentra registrado');
        throw error;
      }
    }
    throw new ConflictException('No se pudo completar la operación');
  }

  async getPermissions(actorId: number) {
    const actor = await this.actor(actorId);
    const permissions = managementPermissions(actor);
    return {
      ...permissions,
      services: permissions.isAdmin
        ? await this.usersRepository.listServices()
        : actor.servicio?.activo
          ? [actor.servicio]
          : [],
    };
  }

  getUsers(actorId: number) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(actorId, tx);
      const permissions = requireManager(actor);
      return this.usersRepository.findAll(
        permissions.isAdmin
          ? {}
          : {
              servicioId: actor.servicioId!,
              esCoordinador: false,
              id: { not: actor.id },
              rol: { in: permissions.allowedRoles },
            },
        tx,
      );
    });
  }

  async searchUsers(
    actorId: number,
    query: Record<string, string | undefined>,
  ) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      ![10, 20, 50].includes(limit)
    )
      throw new BadRequestException('Paginación no válida');
    if (
      query.rol &&
      !Object.values(RolUsuario).includes(query.rol as RolUsuario)
    )
      throw new BadRequestException('Rol no válido');
    if (query.estado && !['ACTIVO', 'INACTIVO'].includes(query.estado))
      throw new BadRequestException('Estado no válido');
    return this.transaction(async (tx) => {
      const actor = await this.actor(actorId, tx);
      const permissions = requireManager(actor);
      const scope: Prisma.UsuarioWhereInput = permissions.isAdmin
        ? {}
        : {
            servicioId: actor.servicioId!,
            esCoordinador: false,
            id: { not: actor.id },
            rol: { in: permissions.allowedRoles },
          };
      const search = query.search?.trim();
      const filters: Prisma.UsuarioWhereInput = {
        ...scope,
        ...(query.rol ? { rol: query.rol as RolUsuario } : {}),
        ...(query.estado ? { activo: query.estado === 'ACTIVO' } : {}),
        ...(search
          ? {
              OR: [
                { nombre: { contains: search } },
                { correo: { contains: search } },
              ],
            }
          : {}),
      };
      const [total, users] = await this.usersRepository.findPage(
        filters,
        page,
        limit,
        tx,
      );
      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });
  }

  getUser(id: number, actorId: number) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(actorId, tx);
      requireManagedTarget(actor, await this.usersRepository.findActor(id, tx));
      return (await this.usersRepository.findAll({ id }, tx))[0];
    });
  }

  private async validateServiceRole(
    servicioId: number | null | undefined,
    rol: string,
    tx: Prisma.TransactionClient,
  ) {
    if (servicioId == null) return;
    const service = await this.usersRepository.findService(servicioId, tx);
    if (
      !service?.activo ||
      !SERVICE_ROLES[service.codigo]?.some((r) => r === rol)
    ) {
      throw new BadRequestException(
        'El servicio debe estar activo y ser compatible con el rol',
      );
    }
  }

  async createUser(dto: CreateUserDto, actorId: number) {
    // Check access before expensive hashing; recheck inside the transaction.
    requireManager(await this.actor(actorId));
    const password = await bcrypt.hash(dto.password, 10);
    return this.transaction(async (tx) => {
      const actor = await this.actor(actorId, tx);
      const permissions = requireManager(actor);
      if (!permissions.isAdmin && dto.servicioId !== undefined)
        throw new ForbiddenException(
          'El coordinador no puede asignar servicios',
        );
      if (!permissions.allowedRoles.includes(dto.rol))
        throw new ForbiddenException('Rol fuera del alcance autorizado');
      const servicioId = permissions.isAdmin
        ? dto.servicioId
        : actor.servicioId!;
      await this.validateServiceRole(servicioId, dto.rol, tx);
      if (await this.usersRepository.findByEmail(dto.correo, tx))
        throw new ConflictException('El correo ya se encuentra registrado');
      const user = await this.usersRepository.create(
        dto.nombre,
        dto.correo,
        password,
        dto.rol,
        servicioId,
        tx,
      );
      return { message: 'Usuario registrado correctamente', user };
    });
  }

  async updateUser(id: number, dto: UpdateUserDto, actorId: number) {
    const initial = requireManager(await this.actor(actorId));
    if (
      !initial.isAdmin &&
      (dto.correo !== undefined || dto.password !== undefined)
    )
      throw new ForbiddenException(
        'Solo el administrador puede cambiar correo o contraseña',
      );
    const hashed = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;
    return this.transaction(async (tx) => {
      const actor = await this.actor(actorId, tx);
      const permissions = requireManager(actor);
      const target = requireManagedTarget(
        actor,
        await this.usersRepository.findActor(id, tx),
      );
      if (
        !permissions.isAdmin &&
        (dto.correo !== undefined || dto.password !== undefined)
      )
        throw new ForbiddenException(
          'Solo el administrador puede cambiar correo o contraseña',
        );
      if (dto.rol && !permissions.allowedRoles.includes(dto.rol))
        throw new ForbiddenException('Rol fuera del alcance autorizado');
      if (dto.rol && dto.rol !== target.rol) {
        if (id === actorId)
          throw new ForbiddenException('No puedes modificar tu propio alcance');
        if (
          target.rol === 'ADMINISTRADOR' &&
          target.activo &&
          (await this.usersRepository.countActiveAdministrators(tx)) <= 1
        )
          throw new ConflictException(
            'Debe conservarse un administrador activo',
          );
        if (target.esCoordinador)
          throw new BadRequestException(
            'Retira primero la coordinación antes de cambiar el rol',
          );
        await this.validateServiceRole(target.servicioId, dto.rol, tx);
      }
      if (dto.correo) {
        const existing = await this.usersRepository.findByEmail(dto.correo, tx);
        if (existing && existing.id !== id)
          throw new ConflictException('El correo ya se encuentra registrado');
      }
      const user = await this.usersRepository.update(
        id,
        {
          nombre: dto.nombre,
          correo: dto.correo,
          rol: dto.rol,
          password: hashed,
        },
        tx,
      );
      return { message: 'Usuario actualizado correctamente', user };
    });
  }

  updateUserStatus(id: number, dto: UpdateUserStatusDto, actorId: number) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(actorId, tx);
      const target = requireManagedTarget(
        actor,
        await this.usersRepository.findActor(id, tx),
      );
      if (
        !dto.activo &&
        target.activo &&
        target.rol === 'ADMINISTRADOR' &&
        (await this.usersRepository.countActiveAdministrators(tx)) <= 1
      )
        throw new ConflictException('Debe conservarse un administrador activo');
      const user = await this.usersRepository.updateStatus(id, dto.activo, tx);
      return {
        message: dto.activo
          ? 'Usuario activado correctamente'
          : 'Usuario desactivado correctamente',
        user,
      };
    });
  }

  updateUserScope(id: number, dto: UpdateUserScopeDto, actorId: number) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(actorId, tx);
      if (actor.rol !== 'ADMINISTRADOR')
        throw new ForbiddenException(
          'Solo el administrador puede asignar servicios y coordinación',
        );
      if (actorId === id)
        throw new ForbiddenException('No puedes modificar tu propio alcance');
      const target = requireManagedTarget(
        actor,
        await this.usersRepository.findActor(id, tx),
      );
      if (
        dto.esCoordinador &&
        (dto.servicioId === null || target.rol === 'ADMINISTRADOR')
      )
        throw new BadRequestException(
          'La coordinación requiere un servicio y un usuario operativo',
        );
      await this.validateServiceRole(dto.servicioId, target.rol, tx);
      const user = await this.usersRepository.update(id, dto, tx);
      return { message: 'Alcance actualizado correctamente', user };
    });
  }
}
