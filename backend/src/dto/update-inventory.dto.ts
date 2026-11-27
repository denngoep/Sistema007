import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { TipoMovimientoInventario } from '../generated/prisma/client';

// TRASLADO INDIVIDUAL

export class TransferInventoryDto {
  @IsInt()
  @Min(1)
  loteId!: number;

  @IsInt()
  @Min(1)
  bodegaOrigenId!: number;

  @IsInt()
  @Min(1)
  bodegaDestinoId!: number;

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @IsString()
  @IsOptional()
  referencia?: string;
}

// PRODUCTO DE TRASLADO MÚLTIPLE

export class TransferInventoryItemDto {
  @IsInt()
  @Min(1)
  loteId!: number;

  @IsInt()
  @Min(1)
  cantidad!: number;
}

// TRASLADO MÚLTIPLE

export class TransferInventoryBatchDto {
  @IsInt()
  @Min(1)
  bodegaOrigenId!: number;

  @IsInt()
  @Min(1)
  bodegaDestinoId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferInventoryItemDto)
  productos!: TransferInventoryItemDto[];

  @IsString()
  @IsNotEmpty()
  motivo!: string;
}

// AJUSTE INDIVIDUAL
// Se conserva para mantener compatibilidad.

export class AdjustInventoryDto {
  @IsInt()
  @Min(1)
  loteId!: number;

  @IsInt()
  @Min(1)
  bodegaId!: number;

  @IsEnum(TipoMovimientoInventario)
  tipo!: TipoMovimientoInventario;

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @IsString()
  @IsOptional()
  referencia?: string;
}

// PRODUCTO PARA AJUSTE POR CONTEO FÍSICO

export class AdjustInventoryBatchItemDto {
  @IsInt()
  @Min(1)
  loteId!: number;

  @IsInt()
  @Min(0)
  cantidadFisica!: number;
}

// AJUSTE MÚLTIPLE POR CONTEO FÍSICO

export class AdjustInventoryBatchDto {
  @IsInt()
  @Min(1)
  bodegaId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdjustInventoryBatchItemDto)
  productos!: AdjustInventoryBatchItemDto[];

  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @IsString()
  @IsOptional()
  referencia?: string;
}
