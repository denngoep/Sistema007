import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { TipoDiagnostico } from '../generated/prisma/enums';

export class CreatePatientDiagnosisDto {
  @IsInt()
  @Min(1)
  pacienteId!: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  atencionClinicaId?: number;

  @IsString()
  nombre!: string;

  @IsString()
  @IsOptional()
  codigoCie10?: string;

  @IsEnum(TipoDiagnostico)
  tipo!: TipoDiagnostico;

  @IsBoolean()
  @IsOptional()
  requiereEsquema?: boolean;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
