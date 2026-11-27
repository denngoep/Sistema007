import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsObject,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CreateClinicalAttentionDto } from './create-clinical-attention.dto';
import { CreateFormulationContentDto } from './create-formulation.dto';
import { CreatePatientDiagnosisContentDto } from './create-patient-diagnosis.dto';

export class CreateClinicalEncounterDto extends CreateClinicalAttentionDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  diagnosticoPacienteId?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => CreatePatientDiagnosisContentDto)
  nuevoDiagnostico?: CreatePatientDiagnosisContentDto;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateFormulationContentDto)
  formulacion!: CreateFormulationContentDto;
}
