import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { getJwtSecret } from './jwt.config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        email: string;
        nombre: string;
      }>(token, {
        secret: getJwtSecret(this.configService),
        algorithms: ['HS256'],
      });

      if (!Number.isInteger(payload.sub) || payload.sub <= 0) {
        throw new UnauthorizedException('Usuario del token no válido');
      }

      (request as Request & { user: typeof payload }).user = payload;

      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }
  }
}
