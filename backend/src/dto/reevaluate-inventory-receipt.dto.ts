import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  EstadoVerificacionInvima,
  ResultadoVerificacionIngreso,
} from '../generated/prisma/client';

export class ReevaluateInventoryReceiptDto {
  @IsEnum(ResultadoVerificacionIngreso)
  resultadoNuevo: ResultadoVerificacionIngreso;

  @IsEnum(EstadoVerificacionInvima)
  estadoInvimaNuevo: EstadoVerificacionInvima;

  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  motivo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  referencia: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  observaciones?: string;
}
