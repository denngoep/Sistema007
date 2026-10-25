import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateAuthUserParams = {
  nombre: string;
  correo: string;
  password: string;
};

type CreatePasswordRecoveryParams = {
  usuarioId: number;
  codigoHash: string;
  fechaExpiracion: Date;
};

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Busca un usuario por su correo
  findByEmail(correo: string) {
    return this.prisma.usuario.findUnique({
      where: { correo },
    });
  }

  // Crea un nuevo usuario
  createUser(data: CreateAuthUserParams) {
    return this.prisma.usuario.create({
      data,
      select: {
        id: true,
        nombre: true,
        correo: true,
        activo: true,
        createdAt: true,
      },
    });
  }

  // Suma un intento fallido al usuario
  incrementFailedAttempts(id: number) {
    return this.prisma.usuario.update({
      where: { id },
      data: {
        intentosFallidos: { increment: 1 },
      },
    });
  }

  // Reinicia los intentos fallidos después de un login correcto
  resetFailedAttempts(id: number) {
    return this.prisma.usuario.update({
      where: { id },
      data: { intentosFallidos: 0 },
    });
  }

  // Bloquea al usuario
  blockUser(id: number) {
    return this.prisma.usuario.update({
      where: { id },
      data: { activo: false },
    });
  }

  // Cuenta solicitudes de recuperación durante la última hora
  countRecentRecoveryRequests(usuarioId: number, desde: Date) {
    return this.prisma.recuperacionPassword.count({
      where: {
        usuarioId,
        createdAt: { gte: desde },
      },
    });
  }

  // Invalida los códigos anteriores
  invalidatePreviousRecoveryCodes(usuarioId: number) {
    return this.prisma.recuperacionPassword.updateMany({
      where: {
        usuarioId,
        utilizado: false,
      },
      data: { utilizado: true },
    });
  }

  // Guarda un nuevo código de recuperación protegido
  createPasswordRecovery(data: CreatePasswordRecoveryParams) {
    return this.prisma.recuperacionPassword.create({
      data,
    });
  }

  // Consulta el último código de recuperación vigente
  findLatestPasswordRecovery(usuarioId: number) {
    return this.prisma.recuperacionPassword.findFirst({
      where: {
        usuarioId,
        utilizado: false,
        fechaExpiracion: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Incrementa los intentos fallidos de verificación
  incrementRecoveryAttempts(id: number) {
    return this.prisma.recuperacionPassword.update({
      where: { id },
      data: {
        intentosFallidos: { increment: 1 },
      },
    });
  }

  // Invalida un código de recuperación
  invalidateRecoveryCode(id: number) {
    return this.prisma.recuperacionPassword.update({
      where: { id },
      data: { utilizado: true },
    });
  }

  // Actualiza la contraseña y consume el código en una transacción
  updatePasswordWithRecovery(
    usuarioId: number,
    recoveryId: number,
    hashedPassword: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const recovery = await tx.recuperacionPassword.updateMany({
        where: {
          id: recoveryId,
          usuarioId,
          utilizado: false,
          fechaExpiracion: { gt: new Date() },
          intentosFallidos: { lt: 3 },
        },
        data: { utilizado: true },
      });

      if (recovery.count !== 1) {
        throw new Error('Código de recuperación inválido o expirado');
      }

      await tx.usuario.update({
        where: { id: usuarioId },
        data: { password: hashedPassword },
      });

      await tx.recuperacionPassword.updateMany({
        where: { usuarioId, utilizado: false },
        data: { utilizado: true },
      });
    });
  }
}
