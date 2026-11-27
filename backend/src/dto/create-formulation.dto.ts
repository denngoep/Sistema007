import {
  IsArray,
  ArrayNotEmpty,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Max,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFormulationDetailDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'El medicamento es obligatorio' })
  medicamento!: string;

  @IsString()
  @IsOptional()
  concentracion?: string;

  @IsString()
  @IsOptional()
  formaFarmaceutica?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'La dosis es obligatoria' })
  dosis!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'La frecuencia es obligatoria' })
  frecuencia!: string;

  @IsString()
  @Matches(/\S/, {
    message:
      'La duración del tratamiento es obligatoria; no equivale a la vigencia de la fórmula',
  })
  duracion!: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  cantidad!: number;

  @IsString()
  @IsOptional()
  viaAdministracion?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class CreateFormulationContentDto {
  @IsInt()
  @Min(1)
  vigenciaMeses!: number;

  @IsString()
  @IsOptional()
  indicaciones?: string;

  @IsArray()
  @ArrayNotEmpty({
    message: 'La formulación debe incluir al menos un medicamento',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateFormulationDetailDto)
  medicamentos!: CreateFormulationDetailDto[];
}

export class CreateFormulationDto extends CreateFormulationContentDto {
  @IsInt()
  @Min(1)
  atencionClinicaId!: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  diagnosticoPacienteId?: number;
}
