import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CondicionConservacion,
  TipoProductoInventario,
} from '../generated/prisma/client';

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

  @IsOptional()
  @IsString()
  viaAdministracion?: string;
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

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  laboratorio?: string;

  @IsOptional()
  @IsString()
  registroInvima?: string;

  @IsOptional()
  @IsEnum(CondicionConservacion)
  condicionConservacion?: CondicionConservacion;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  temperaturaMinima?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  temperaturaMaxima?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  humedadMaxima?: number;

  @IsOptional()
  @IsString()
  claseRiesgo?: string;
}
