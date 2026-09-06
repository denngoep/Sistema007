import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { RolUsuario } from '../generated/prisma/enums';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  correo?: string;

  @IsOptional()
  @MinLength(8, {
    message: 'La contraseña debe tener mínimo 8 caracteres',
  })
  password?: string;

  @IsOptional()
  @IsEnum(RolUsuario, {
    message: 'El rol seleccionado no es válido',
  })
  rol?: RolUsuario;
}
