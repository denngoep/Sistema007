import { Module } from '@nestjs/common';

import { InventoryController } from '../controllers/inventory.controller';
import { InventoryRepository } from '../repositories/inventory.repository';
import { InventoryService } from '../services/inventory.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRepository],
  exports: [InventoryService],
})
export class InventoryModule {}
