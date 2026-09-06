import { ConflictException, Injectable } from '@nestjs/common';

import { PatientsRepository } from '../repositories/patients.repository';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { UpdatePatientDto } from '../dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly patientsRepository: PatientsRepository) {}

  getPatients() {
    return this.patientsRepository.findAll();
  }

  async updatePatient(id: number, updatePatientDto: UpdatePatientDto) {
    if (updatePatientDto.numeroDocumento) {
      const existingPatient = await this.patientsRepository.findByDocument(
        updatePatientDto.numeroDocumento,
      );

      if (existingPatient && existingPatient.id !== id) {
        throw new ConflictException(
          'El número de documento ya se encuentra registrado',
        );
      }
    }

    const data: {
      tipoDocumento?: string;
      numeroDocumento?: string;
      nombres?: string;
      apellidos?: string;
      fechaNacimiento?: Date;
      telefono?: string;
      correo?: string;
    } = {
      tipoDocumento: updatePatientDto.tipoDocumento,
      numeroDocumento: updatePatientDto.numeroDocumento,
      nombres: updatePatientDto.nombres,
      apellidos: updatePatientDto.apellidos,
      telefono: updatePatientDto.telefono,
      correo: updatePatientDto.correo,
    };

    if (updatePatientDto.fechaNacimiento) {
      data.fechaNacimiento = new Date(updatePatientDto.fechaNacimiento);
    }

    const patient = await this.patientsRepository.update(id, data);

    return {
      message: 'Paciente actualizado correctamente',
      patient,
    };
  }

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
