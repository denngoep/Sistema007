import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { InventoryController } from '../controllers/inventory.controller';
import { InventoryMovementsController } from '../controllers/inventory-movements.controller';

import { InventoryRepository } from '../repositories/inventory.repository';
import { InventoryMovementsRepository } from '../repositories/inventory-movements.repository';
import { InventoryVerificationRepository } from '../repositories/inventory-verification.repository';
import { InventoryReceiptCorrectionRepository } from '../repositories/inventory-receipt-correction.repository';
import { NonConformingRepository } from '../repositories/non-conforming.repository';

import { InventoryService } from '../services/inventory.service';
import { InventoryMovementsService } from '../services/inventory-movements.service';
import { InventoryDocumentsService } from './inventory-documents.service';
import { InventoryPrivateDocumentStore } from './inventory-private-document.store';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, JwtModule],
  controllers: [InventoryController, InventoryMovementsController],
  providers: [
    InventoryService,
    InventoryMovementsService,
    InventoryDocumentsService,
    InventoryPrivateDocumentStore,
    InventoryRepository,
    InventoryMovementsRepository,
    InventoryVerificationRepository,
    InventoryReceiptCorrectionRepository,
    NonConformingRepository,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
