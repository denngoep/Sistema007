import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoProductoInventario } from '../generated/prisma/client';

export class CreateMedicationDataDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  concentracion!: string;

  @IsString()
  @IsNotEmpty()
  formaFarmaceutica!: string;

  @IsString()
  @IsOptional()
  viaAdministracion?: string;
}

export class CreateInventoryBatchDto {
  @IsString()
  @IsNotEmpty()
  numeroLote!: string;

  @IsDateString()
  fechaVencimiento!: string;

  @IsInt()
  @Min(0)
  cantidad!: number;
}

export class CreateInventoryProductDto {
  @IsEnum(TipoProductoInventario)
  tipo!: TipoProductoInventario;

  @ValidateIf(
    (object: CreateInventoryProductDto) =>
      object.tipo === TipoProductoInventario.MEDICAMENTO,
  )
  @ValidateNested()
  @Type(() => CreateMedicationDataDto)
  medicamento?: CreateMedicationDataDto;

  @IsString()
  @IsNotEmpty()
  descripcion!: string;

  @IsString()
  @IsOptional()
  marca?: string;

  @IsString()
  @IsOptional()
  laboratorio?: string;

  @IsString()
  @IsOptional()
  registroInvima?: string;

  @ValidateNested()
  @Type(() => CreateInventoryBatchDto)
  lote!: CreateInventoryBatchDto;
}
