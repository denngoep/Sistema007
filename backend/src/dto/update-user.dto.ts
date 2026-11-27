import {
  IsEmail,
  IsEnum,
  ValidateIf,
  Matches,
  IsString,
  MinLength,
} from 'class-validator';

import { RolUsuario } from '../generated/prisma/enums';

export class UpdateUserDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/\S/, { message: 'El nombre no puede estar vacío' })
  nombre?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEmail({}, { message: 'El correo no es válido' })
  correo?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(8, {
    message: 'La contraseña debe tener mínimo 8 caracteres',
  })
  password?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(RolUsuario, {
    message: 'El rol seleccionado no es válido',
  })
  rol?: RolUsuario;
}
