import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  MinLength,
  IsInt,
  Min,
  ValidateIf,
  IsString,
  Matches,
} from 'class-validator';

import { RolUsuario } from '../generated/prisma/enums';

export class CreateUserDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  servicioId?: number;
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @Matches(/\S/, { message: 'El nombre no puede estar vacío' })
  nombre!: string;

  @IsEmail({}, { message: 'El correo no es válido' })
  correo!: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener mínimo 8 caracteres' })
  password!: string;

  @IsNotEmpty({ message: 'El rol es obligatorio' })
  @IsEnum(RolUsuario, { message: 'El rol seleccionado no es válido' })
  rol!: RolUsuario;
}
