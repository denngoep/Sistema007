import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClinicalHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPatientId(pacienteId: number) {
    const paciente = await this.prisma.paciente.findUnique({
      where: {
        id: pacienteId,
      },
      include: {
        historiaClinica: true,
      },
    });

    if (!paciente) {
      return null;
    }

    return {
      paciente: {
        id: paciente.id,
        tipoDocumento: paciente.tipoDocumento,
        numeroDocumento: paciente.numeroDocumento,
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        fechaNacimiento: paciente.fechaNacimiento,
        telefono: paciente.telefono,
        correo: paciente.correo,
        activo: paciente.activo,
      },
      historiaClinica: paciente.historiaClinica,
    };
  }
}
