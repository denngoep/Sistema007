import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre!: string;

  @IsEmail({}, { message: 'El email no es válido' })
  email!: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, {
    message: 'La contraseña debe tener al menos 6 caracteres',
  })
  password!: string;
}
