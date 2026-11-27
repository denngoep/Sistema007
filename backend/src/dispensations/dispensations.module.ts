import { DispensationDocumentsService } from './dispensation-documents.service';

import { PrivateDocumentStore } from './private-document.store';

import { Module } from '@nestjs/common';

import { JwtModule } from '@nestjs/jwt';

import { DispensationsController } from '../controllers/dispensations.controller';

import { DispensationsRepository } from '../repositories/dispensations.repository';

import { DispensationsService } from '../services/dispensations.service';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule.register({})],

  controllers: [DispensationsController],

  providers: [
    DispensationsService,
    DispensationsRepository,
    DispensationDocumentsService,
    PrivateDocumentStore,
  ],

  exports: [DispensationsService],
})
export class DispensationsModule {}
