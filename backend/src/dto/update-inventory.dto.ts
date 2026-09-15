import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { TipoMovimientoInventario } from '../generated/prisma/client';

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
