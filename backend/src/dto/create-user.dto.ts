import { IsEmail, IsEnum, IsNotEmpty, MinLength } from 'class-validator';

import { RolUsuario } from '../generated/prisma/enums';

export class CreateUserDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre!: string;

  @IsEmail({}, { message: 'El correo no es válido' })
  correo!: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(8, { message: 'La contraseña debe tener mínimo 8 caracteres' })
  password!: string;

  @IsNotEmpty({ message: 'El rol es obligatorio' })
  @IsEnum(RolUsuario, { message: 'El rol seleccionado no es válido' })
  rol!: RolUsuario;
}
