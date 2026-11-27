import { Type } from 'class-transformer';

import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class DispensationSupportDto {
  @Type(() => Number) @IsInt() @Min(0) versionEsperada!: number;

  @Type(() => Number) @IsInt() @Min(1) documentoBaseId!: number;

  @IsIn(['DIGITAL', 'MANUAL']) modalidad!: 'DIGITAL' | 'MANUAL';

  @IsIn(['PACIENTE', 'TERCERO_AUTORIZADO']) tipoReceptor!: string;

  @IsString() @IsNotEmpty() @MaxLength(191) nombreReceptor!: string;

  @IsString() @IsNotEmpty() @MaxLength(32) tipoDocumentoReceptor!: string;

  @IsString() @IsNotEmpty() @MaxLength(191) numeroDocumentoReceptor!: string;

  @IsOptional() @IsString() @MaxLength(191) relacionReceptor?: string;

  @IsOptional() @IsString() @MaxLength(2000) constanciaAutorizacion?: string;

  @IsISO8601() fechaFirma!: string;

  @IsOptional() @IsString() @MaxLength(2000) motivoCorreccion?: string;
}
