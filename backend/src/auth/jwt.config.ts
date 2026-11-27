import { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';

// Preserve the configured value exactly: trimming it would invalidate tokens.
export function getJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET');

  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret.trim(), 'utf8') < 32 ||
    secret.trim() === 'dev-secret-change-me'
  ) {
    throw new Error(
      'JWT_SECRET debe estar configurado con un secreto seguro de al menos 32 bytes.',
    );
  }

  return secret;
}

export function getJwtOptions(configService: ConfigService): JwtModuleOptions {
  return {
    secret: getJwtSecret(configService),
    signOptions: { expiresIn: '1d', algorithm: 'HS256' },
    verifyOptions: { algorithms: ['HS256'] },
  };
}
