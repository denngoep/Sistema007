import { ConflictException, Injectable } from '@nestjs/common';

import { PatientsRepository } from '../repositories/patients.repository';
import { CreatePatientDto } from '../dto/create-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly patientsRepository: PatientsRepository) {}

  async createPatient(createPatientDto: CreatePatientDto) {
    const existingPatient = await this.patientsRepository.findByDocument(
      createPatientDto.numeroDocumento,
    );

    if (existingPatient) {
      throw new ConflictException('El paciente ya se encuentra registrado');
    }

    const patient = await this.patientsRepository.create({
      tipoDocumento: createPatientDto.tipoDocumento,
      numeroDocumento: createPatientDto.numeroDocumento,
      nombres: createPatientDto.nombres,
      apellidos: createPatientDto.apellidos,
      fechaNacimiento: new Date(createPatientDto.fechaNacimiento),
      telefono: createPatientDto.telefono,
      correo: createPatientDto.correo,
    });

    return {
      message: 'Paciente registrado correctamente',
      patient,
    };
  }
}
