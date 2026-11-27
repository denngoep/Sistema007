import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/\S/, { message: 'El campo no puede estar vac?o' })
  tipoDocumento!: string;

  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/\S/, { message: 'El campo no puede estar vac?o' })
  numeroDocumento!: string;

  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/\S/, { message: 'El campo no puede estar vac?o' })
  nombres!: string;

  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/\S/, { message: 'El campo no puede estar vac?o' })
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
