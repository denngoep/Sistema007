import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePatientDto {
  @IsNotEmpty({ message: 'El tipo de documento es obligatorio' })
  @IsString()
  tipoDocumento!: string;

  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @IsString()
  numeroDocumento!: string;

  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  @IsString()
  nombres!: string;

  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @IsString()
  apellidos!: string;

  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria' })
  @IsDateString({}, { message: 'La fecha de nacimiento no es válida' })
  fechaNacimiento!: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  correo?: string;
}
