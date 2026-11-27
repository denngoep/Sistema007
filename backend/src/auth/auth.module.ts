import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { AuthRepository } from '../repositories/auth.repository';
import { MailService } from '../services/mail.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { getJwtOptions } from './jwt.config';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: getJwtOptions,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, MailService, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
