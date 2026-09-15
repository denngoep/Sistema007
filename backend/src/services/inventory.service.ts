import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateInventoryProductDto } from '../dto/create-inventory-product.dto';
import { CreateWarehouseDto } from '../dto/create-warehouse.dto';
import {
  AdjustInventoryDto,
  TransferInventoryDto,
} from '../dto/update-inventory.dto';
import {
  TipoMovimientoInventario,
  TipoProductoInventario,
} from '../generated/prisma/client';
import { InventoryRepository } from '../repositories/inventory.repository';

@Injectable()
export class InventoryService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async createProduct(createInventoryProductDto: CreateInventoryProductDto) {
    let medicamentoId: number | undefined;

    if (createInventoryProductDto.tipo === TipoProductoInventario.MEDICAMENTO) {
      if (!createInventoryProductDto.medicamento) {
        throw new BadRequestException(
          'Los datos del medicamento son obligatorios',
        );
      }

      const medicationData = createInventoryProductDto.medicamento;

      let medication = await this.inventoryRepository.findMedication(
        medicationData.nombre,
        medicationData.concentracion,
        medicationData.formaFarmaceutica,
      );

      if (!medication) {
        medication = await this.inventoryRepository.createMedication({
          nombre: medicationData.nombre,
          concentracion: medicationData.concentracion,
          formaFarmaceutica: medicationData.formaFarmaceutica,
          viaAdministracion: medicationData.viaAdministracion,
        });
      }

      medicamentoId = medication.id;
    }

    const lastProduct = await this.inventoryRepository.getLastProduct();

    const codigoInterno =
      lastProduct?.codigoInterno != null ? lastProduct.codigoInterno + 1 : 1000;

    if (codigoInterno > 9999) {
      throw new BadRequestException(
        'Se agotó el rango disponible de códigos internos de 4 dígitos',
      );
    }

    const existingCode =
      await this.inventoryRepository.findProductByCode(codigoInterno);

    if (existingCode) {
      throw new ConflictException(
        'El código interno generado ya se encuentra registrado',
      );
    }

    return this.inventoryRepository.createProduct({
      medicamentoId,
      codigoInterno,
      tipo: createInventoryProductDto.tipo,
      descripcion: createInventoryProductDto.descripcion,
      marca: createInventoryProductDto.marca,
      laboratorio: createInventoryProductDto.laboratorio,
      registroInvima: createInventoryProductDto.registroInvima,
      lote: {
        numeroLote: createInventoryProductDto.lote.numeroLote,
        fechaVencimiento: new Date(
          createInventoryProductDto.lote.fechaVencimiento,
        ),
        cantidad: createInventoryProductDto.lote.cantidad,
      },
    });
  }

  async getAllProducts() {
    const products = await this.inventoryRepository.findAllProducts();

    return {
      totalProductos: products.length,
      productos: products,
    };
  }

  async createWarehouse(createWarehouseDto: CreateWarehouseDto) {
    const sede = await this.inventoryRepository.findSiteById(
      createWarehouseDto.sedeId,
    );

    if (!sede) {
      throw new NotFoundException('La sede indicada no existe');
    }

    if (!sede.activa) {
      throw new BadRequestException('La sede indicada está inactiva');
    }

    const existingWarehouse =
      await this.inventoryRepository.findWarehouseByNameInSite(
        createWarehouseDto.sedeId,
        createWarehouseDto.nombre.trim(),
      );

    if (existingWarehouse) {
      throw new ConflictException(
        'Ya existe una bodega con este nombre en la sede indicada',
      );
    }

    return this.inventoryRepository.createWarehouse({
      sedeId: createWarehouseDto.sedeId,
      nombre: createWarehouseDto.nombre.trim(),
      descripcion: createWarehouseDto.descripcion?.trim(),
      permiteDispensacion: createWarehouseDto.permiteDispensacion ?? false,
    });
  }

  async transferInventory(
    transferInventoryDto: TransferInventoryDto,
    usuarioId: number,
  ) {
    if (
      transferInventoryDto.bodegaOrigenId ===
      transferInventoryDto.bodegaDestinoId
    ) {
      throw new BadRequestException(
        'La bodega de origen y la bodega de destino deben ser diferentes',
      );
    }

    const lote = await this.inventoryRepository.findBatchById(
      transferInventoryDto.loteId,
    );

    if (!lote) {
      throw new NotFoundException('El lote indicado no existe');
    }

    const bodegaOrigen = await this.inventoryRepository.findWarehouseById(
      transferInventoryDto.bodegaOrigenId,
    );

    if (!bodegaOrigen) {
      throw new NotFoundException('La bodega de origen no existe');
    }

    if (!bodegaOrigen.activa) {
      throw new BadRequestException('La bodega de origen está inactiva');
    }

    const bodegaDestino = await this.inventoryRepository.findWarehouseById(
      transferInventoryDto.bodegaDestinoId,
    );

    if (!bodegaDestino) {
      throw new NotFoundException('La bodega de destino no existe');
    }

    if (!bodegaDestino.activa) {
      throw new BadRequestException('La bodega de destino está inactiva');
    }

    const existencia = await this.inventoryRepository.findStock(
      transferInventoryDto.loteId,
      transferInventoryDto.bodegaOrigenId,
    );

    if (!existencia) {
      throw new NotFoundException(
        'El lote no tiene existencia registrada en la bodega de origen',
      );
    }

    if (existencia.cantidad < transferInventoryDto.cantidad) {
      throw new BadRequestException(
        'No hay existencias suficientes para realizar el traslado',
      );
    }

    try {
      return await this.inventoryRepository.transferStock({
        loteId: transferInventoryDto.loteId,
        bodegaOrigenId: transferInventoryDto.bodegaOrigenId,
        bodegaDestinoId: transferInventoryDto.bodegaDestinoId,
        cantidad: transferInventoryDto.cantidad,
        usuarioId,
        motivo: transferInventoryDto.motivo,
        referencia: transferInventoryDto.referencia,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'EXISTENCIA_ORIGEN_NO_ENCONTRADA') {
          throw new NotFoundException(
            'El lote no tiene existencia registrada en la bodega de origen',
          );
        }

        if (error.message === 'STOCK_INSUFICIENTE') {
          throw new BadRequestException(
            'No hay existencias suficientes para realizar el traslado',
          );
        }
      }

      throw error;
    }
  }

  async adjustInventory(
    adjustInventoryDto: AdjustInventoryDto,
    usuarioId: number,
  ) {
    if (
      adjustInventoryDto.tipo !== TipoMovimientoInventario.AJUSTE_ENTRADA &&
      adjustInventoryDto.tipo !== TipoMovimientoInventario.AJUSTE_SALIDA
    ) {
      throw new BadRequestException(
        'Solo se permiten movimientos de AJUSTE_ENTRADA o AJUSTE_SALIDA',
      );
    }

    const lote = await this.inventoryRepository.findBatchById(
      adjustInventoryDto.loteId,
    );

    if (!lote) {
      throw new NotFoundException('El lote indicado no existe');
    }

    const bodega = await this.inventoryRepository.findWarehouseById(
      adjustInventoryDto.bodegaId,
    );

    if (!bodega) {
      throw new NotFoundException('La bodega indicada no existe');
    }

    if (!bodega.activa) {
      throw new BadRequestException('La bodega indicada está inactiva');
    }

    if (adjustInventoryDto.tipo === TipoMovimientoInventario.AJUSTE_SALIDA) {
      const existencia = await this.inventoryRepository.findStock(
        adjustInventoryDto.loteId,
        adjustInventoryDto.bodegaId,
      );

      if (!existencia) {
        throw new NotFoundException(
          'El lote no tiene existencia registrada en esta bodega',
        );
      }

      if (existencia.cantidad < adjustInventoryDto.cantidad) {
        throw new BadRequestException(
          'No hay existencias suficientes para realizar el ajuste de salida',
        );
      }
    }

    try {
      return await this.inventoryRepository.adjustStock({
        loteId: adjustInventoryDto.loteId,
        bodegaId: adjustInventoryDto.bodegaId,
        tipo: adjustInventoryDto.tipo,
        cantidad: adjustInventoryDto.cantidad,
        usuarioId,
        motivo: adjustInventoryDto.motivo,
        referencia: adjustInventoryDto.referencia,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'EXISTENCIA_NO_ENCONTRADA') {
          throw new NotFoundException(
            'El lote no tiene existencia registrada en esta bodega',
          );
        }

        if (error.message === 'STOCK_INSUFICIENTE') {
          throw new BadRequestException(
            'No hay existencias suficientes para realizar el ajuste',
          );
        }
      }

      throw error;
    }
  }
}
