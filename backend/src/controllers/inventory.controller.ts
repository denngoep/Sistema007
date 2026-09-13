import { Body, Controller, Post } from '@nestjs/common';

import { CreateInventoryProductDto } from '../dto/create-inventory-product.dto';
import { InventoryService } from '../services/inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('products')
  createProduct(@Body() createInventoryProductDto: CreateInventoryProductDto) {
    return this.inventoryService.createProduct(createInventoryProductDto);
  }
}
