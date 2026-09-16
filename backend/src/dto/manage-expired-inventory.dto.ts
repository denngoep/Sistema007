import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ManageExpiredInventoryDto {
  @IsInt()
  @Min(1)
  loteId!: number;

  @IsInt()
  @Min(1)
  bodegaOrigenId!: number;

  @IsInt()
  @Min(1)
  bodegaDestinoId!: number;

  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @IsString()
  @IsOptional()
  referencia?: string;
}
