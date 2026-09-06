import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  correo?: string;

  @IsOptional()
  @MinLength(6, {
    message: 'La contraseña debe tener al menos 6 caracteres',
  })
  password?: string;
}
