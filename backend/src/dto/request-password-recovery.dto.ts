import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestPasswordRecoveryDto {
  @IsEmail({}, { message: 'Debes ingresar un correo válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email!: string;
}
