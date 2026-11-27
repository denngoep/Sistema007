import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoBodega } from '../generated/prisma/enums';

export class UpdateWarehouseDto {
  @IsString()
  @IsOptional()
  codigo?: string;

  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  descripcion?: string | null;

  @IsEnum(TipoBodega)
  @IsOptional()
  tipo?: TipoBodega;

  @IsBoolean()
  @IsOptional()
  permiteDispensacion?: boolean;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;
}
