import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolUsuario } from '../generated/prisma/enums';

export const SERVICE_ROLES: Record<string, readonly RolUsuario[]> = {
  ASISTENCIAL: ['MEDICO', 'ENFERMERO', 'AUXILIAR_ENFERMERIA'],
  FARMACIA: ['QUIMICO_FARMACEUTICO', 'REGENTE_FARMACIA', 'AUXILIAR_FARMACIA'],
  ADMISIONES: ['RECEPCION_ADMISIONES'],
};

export interface ManagementActor {
  id: number;
  activo: boolean;
  rol: RolUsuario;
  servicioId: number | null;
  esCoordinador: boolean;
  servicio: {
    id: number;
    codigo: string;
    nombre: string;
    activo: boolean;
  } | null;
}

export function managementPermissions(actor: ManagementActor) {
  if (!actor.activo) throw new ForbiddenException('Usuario inactivo');
  const isAdmin = actor.rol === 'ADMINISTRADOR';
  const roles = isAdmin
    ? Object.values(RolUsuario)
    : actor.esCoordinador && actor.servicioId && actor.servicio?.activo
      ? [...(SERVICE_ROLES[actor.servicio.codigo] ?? [])]
      : [];
  return {
    canManageUsers: roles.length > 0,
    isAdmin,
    allowedRoles: roles,
    servicio: actor.servicio,
    userId: actor.id,
  };
}

export function requireManager(actor: ManagementActor) {
  const permissions = managementPermissions(actor);
  if (!permissions.canManageUsers)
    throw new ForbiddenException(
      'No tienes autorización para administrar usuarios',
    );
  return permissions;
}

export function requireManagedTarget(
  actor: ManagementActor,
  target: ManagementActor | null,
) {
  const permissions = requireManager(actor);
  if (
    !target ||
    (!permissions.isAdmin &&
      (target.id === actor.id ||
        target.rol === 'ADMINISTRADOR' ||
        target.esCoordinador ||
        target.servicioId !== actor.servicioId ||
        !permissions.allowedRoles.includes(target.rol)))
  )
    throw new NotFoundException('Usuario no encontrado');
  return target;
}
