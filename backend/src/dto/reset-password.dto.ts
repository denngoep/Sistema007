import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
  Matches,
} from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Debes ingresar un correo válido' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @Length(6, 6, { message: 'El código debe tener 6 dígitos' })
  @Matches(/^\d{6}$/, {
    message: 'El código solo debe contener números',
  })
  codigo!: string;

  @IsString()
  @MinLength(8, {
    message: 'La contraseña debe tener mínimo 8 caracteres',
  })
  @Matches(/[A-Z]/, {
    message: 'La contraseña debe contener una letra mayúscula',
  })
  @Matches(/[a-z]/, {
    message: 'La contraseña debe contener una letra minúscula',
  })
  @Matches(/[0-9]/, {
    message: 'La contraseña debe contener un número',
  })
  nuevaPassword!: string;
}
