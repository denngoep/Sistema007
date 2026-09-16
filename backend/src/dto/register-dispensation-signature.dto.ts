import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class RegisterDispensationSignatureDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['DIGITAL', 'MANUAL'])
  tipoFirma!: 'DIGITAL' | 'MANUAL';

  // Firma capturada directamente desde el dispositivo.
  // Se utiliza cuando tipoFirma es DIGITAL.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firmaPaciente?: string;

  // Referencia al archivo escaneado o fotografiado
  // del comprobante firmado físicamente.
  // Se utiliza cuando tipoFirma es MANUAL.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  soporteFirmado?: string;

  // Fecha real en la que el paciente firmó.
  // En firma DIGITAL el backend utilizará la fecha actual.
  // En firma MANUAL permite conservar la fecha de la entrega,
  // aunque el soporte sea cargado posteriormente.
  @IsOptional()
  @IsISO8601()
  fechaFirma?: string;
}
