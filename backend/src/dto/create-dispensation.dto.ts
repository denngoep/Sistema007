import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateDispensationDto {
  @IsString()
  @IsNotEmpty()
  numeroDocumento!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  formulacionId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  detalleFormulacionId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  bodegaId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  usuarioId!: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
