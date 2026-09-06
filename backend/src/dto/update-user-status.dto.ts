import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso' })
  activo!: boolean;
}
