import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class ValidateDispensationDto {
  @IsString()
  @IsNotEmpty()
  numeroDocumento!: string;

  @IsInt()
  @Min(1)
  formulacionId!: number;

  @IsInt()
  @Min(1)
  detalleFormulacionId!: number;

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsInt()
  @Min(1)
  bodegaId!: number;
}
