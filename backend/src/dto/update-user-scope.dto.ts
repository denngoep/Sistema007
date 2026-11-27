import { IsBoolean, IsInt, Min, ValidateIf } from 'class-validator';

// Both fields are required; null explicitly removes the main service.
export class UpdateUserScopeDto {
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  servicioId!: number | null;

  @IsBoolean()
  esCoordinador!: boolean;
}
