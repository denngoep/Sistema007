/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { CreateInventoryProductDto } from '../dto/create-inventory-product.dto';
import { TipoProductoInventario } from '../generated/prisma/client';
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
}
