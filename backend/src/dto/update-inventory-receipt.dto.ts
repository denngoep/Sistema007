import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateInventoryReceiptDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroFactura?: string;

  @IsOptional()
  @IsDateString()
  fechaFactura?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroOrdenCompra?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroRemision?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
