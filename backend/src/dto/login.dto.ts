import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'El email no es válido' })
  email!: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Debes completar la verificación No soy un robot' })
  captchaToken!: string;
}
