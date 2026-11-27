import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

import { EstadoVerificacionInvimaDto } from './create-inventory-receipt.dto';

export enum ResultadoRevisionRecepcionDto {
  CONFORME = 'CONFORME',
  NO_CONFORME = 'NO_CONFORME',
}

export class ReviewInventoryReceiptDto {
  @IsInt()
  @IsPositive()
  detalleActaId!: number;

  @IsEnum(ResultadoRevisionRecepcionDto)
  resultado!: ResultadoRevisionRecepcionDto;

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

  @IsOptional()
  @IsString()
  observaciones?: string;
}
