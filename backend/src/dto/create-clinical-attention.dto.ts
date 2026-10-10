import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateClinicalAttentionDto {
  @IsInt()
  @Min(1)
  pacienteId!: number;

  @IsInt()
  @Min(1)
  profesionalId!: number;

  @IsOptional()
  @IsString()
  motivoConsulta?: string;

  @IsOptional()
  @IsString()
  evolucion?: string;

  @IsOptional()
  @IsString()
  diagnostico?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
