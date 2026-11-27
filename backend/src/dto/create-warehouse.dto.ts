import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TipoBodega } from '../generated/prisma/enums';

export class CreateWarehouseDto {
  @IsInt()
  @Min(1)
  sedeId!: number;

  @IsString()
  @IsNotEmpty()
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsEnum(TipoBodega)
  @IsOptional()
  tipo?: TipoBodega;

  @IsBoolean()
  @IsOptional()
  permiteDispensacion?: boolean;
}
