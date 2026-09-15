import { Body, Controller, Get, Post } from '@nestjs/common';

import { CreateInventoryProductDto } from '../dto/create-inventory-product.dto';
import { CreateWarehouseDto } from '../dto/create-warehouse.dto';
import {
  AdjustInventoryDto,
  TransferInventoryDto,
} from '../dto/update-inventory.dto';
import { InventoryService } from '../services/inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('products')
  createProduct(@Body() createInventoryProductDto: CreateInventoryProductDto) {
    return this.inventoryService.createProduct(createInventoryProductDto);
  }

  @Get('products')
  getAllProducts() {
    return this.inventoryService.getAllProducts();
  }

  @Post('warehouses')
  createWarehouse(@Body() createWarehouseDto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(createWarehouseDto);
  }

  @Post('transfers')
  transferInventory(@Body() transferInventoryDto: TransferInventoryDto) {
    const usuarioId = 1;

    return this.inventoryService.transferInventory(
      transferInventoryDto,
      usuarioId,
    );
  }

  @Post('adjustments')
  adjustInventory(@Body() adjustInventoryDto: AdjustInventoryDto) {
    const usuarioId = 1;

    return this.inventoryService.adjustInventory(adjustInventoryDto, usuarioId);
  }
}
