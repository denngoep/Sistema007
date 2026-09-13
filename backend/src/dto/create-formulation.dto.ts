import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFormulationDetailDto {
  @IsString()
  @IsNotEmpty()
  medicamento!: string;

  @IsString()
  @IsOptional()
  concentracion?: string;

  @IsString()
  @IsOptional()
  formaFarmaceutica?: string;

  @IsString()
  @IsNotEmpty()
  dosis!: string;

  @IsString()
  @IsNotEmpty()
  frecuencia!: string;

  @IsString()
  @IsOptional()
  duracion?: string;

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsString()
  @IsOptional()
  viaAdministracion?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class CreateFormulationDto {
  @IsInt()
  @Min(1)
  atencionClinicaId!: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  diagnosticoPacienteId?: number;

  @IsInt()
  @Min(1)
  vigenciaMeses!: number;

  @IsString()
  @IsOptional()
  indicaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormulationDetailDto)
  medicamentos!: CreateFormulationDetailDto[];
}
