import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateClinicalAttentionDto {
  @IsInt()
  @Min(1)
  pacienteId!: number;

  @IsString()
  @Matches(/\S/, { message: 'El motivo de consulta es obligatorio' })
  motivoConsulta!: string;

  @IsString()
  @Matches(/\S/, { message: 'La evolución es obligatoria' })
  evolucion!: string;

  @IsString()
  @Matches(/\S/, { message: 'El diagnóstico es obligatorio' })
  diagnostico!: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
