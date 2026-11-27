import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateInventorySupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nit!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  razonSocial!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreComercial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contacto?: string;
}
