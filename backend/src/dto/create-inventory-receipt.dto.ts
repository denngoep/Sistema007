import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum EstadoVerificacionInvimaDto {
  PENDIENTE = 'PENDIENTE',
  VIGENTE = 'VIGENTE',
  NO_VIGENTE = 'NO_VIGENTE',
  NO_APLICA = 'NO_APLICA',
}

export enum ResultadoVerificacionIngresoDto {
  PENDIENTE = 'PENDIENTE',
  CONFORME = 'CONFORME',
  NO_CONFORME = 'NO_CONFORME',
}

export class InventoryReceiptItemDto {
  @IsInt()
  @IsPositive()
  productoId!: number;

  @IsString()
  numeroLote!: string;

  @IsDateString()
  fechaVencimiento!: string;

  @IsInt()
  @IsPositive()
  cantidad!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoUnitario?: number;

  @IsEnum(EstadoVerificacionInvimaDto)
  estadoVerificacionInvima!: EstadoVerificacionInvimaDto;

  @IsOptional()
  @IsNumber()
  temperaturaRegistrada?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  humedadRegistrada?: number;

  @IsEnum(ResultadoVerificacionIngresoDto)
  resultadoVerificacion!: ResultadoVerificacionIngresoDto;

  @IsOptional()
  @IsString()
  observacionesVerificacion?: string;
}

export class CreateInventoryReceiptDto {
  @IsString()
  numeroFactura!: string;

  @IsDateString()
  fechaFactura!: string;

  @IsInt()
  @IsPositive()
  proveedorId!: number;

  @IsInt()
  @IsPositive()
  bodegaDestinoId!: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InventoryReceiptItemDto)
  productos!: InventoryReceiptItemDto[];
}
