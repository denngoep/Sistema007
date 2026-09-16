import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DispensationsRepository } from '../repositories/dispensations.repository';

@Injectable()
export class DispensationsService {
  constructor(
    private readonly dispensationsRepository: DispensationsRepository,
  ) {}

  async getMedicationsToDispense(numeroDocumento: string) {
    const documento = numeroDocumento?.trim();

    if (!documento) {
      throw new BadRequestException(
        'El número de documento del paciente es obligatorio',
      );
    }

    const paciente =
      await this.dispensationsRepository.findPatientByDocument(documento);

    if (!paciente) {
      throw new NotFoundException(
        'No se encontró un paciente con el número de documento indicado',
      );
    }

    if (!paciente.activo) {
      throw new BadRequestException('El paciente se encuentra inactivo');
    }

    if (!paciente.historiaClinica) {
      throw new NotFoundException(
        'El paciente no tiene historia clínica registrada',
      );
    }

    const ahora = new Date();

    const formulacionesVigentes = paciente.historiaClinica.atenciones.flatMap(
      (atencion) =>
        atencion.formulaciones
          .filter((formulacion) => {
            const fechaInicio = new Date(formulacion.fechaFormulacion);

            const fechaFin = new Date(fechaInicio);
            fechaFin.setMonth(fechaFin.getMonth() + formulacion.vigenciaMeses);

            return ahora < fechaFin;
          })
          .map((formulacion) => {
            const fechaInicio = new Date(formulacion.fechaFormulacion);

            const fechaFin = new Date(fechaInicio);
            fechaFin.setMonth(fechaFin.getMonth() + formulacion.vigenciaMeses);

            return {
              formulacionId: formulacion.id,
              fechaFormulacion: formulacion.fechaFormulacion,
              vigenciaMeses: formulacion.vigenciaMeses,
              fechaFinVigencia: fechaFin,
              indicaciones: formulacion.indicaciones,
              estado: formulacion.estado,

              atencion: {
                atencionClinicaId: atencion.id,
                numeroIngreso: atencion.numeroIngreso,
                fechaAtencion: atencion.fechaAtencion,
                profesional: atencion.profesional,
              },

              diagnostico: formulacion.diagnosticoPaciente
                ? {
                    id: formulacion.diagnosticoPaciente.id,
                    nombre: formulacion.diagnosticoPaciente.nombre,
                    codigoCie10: formulacion.diagnosticoPaciente.codigoCie10,
                    tipo: formulacion.diagnosticoPaciente.tipo,
                    requiereEsquema:
                      formulacion.diagnosticoPaciente.requiereEsquema,
                  }
                : null,

              medicamentos: formulacion.medicamentos.map((detalle) => ({
                detalleFormulacionId: detalle.id,
                medicamento: detalle.medicamento,
                concentracion: detalle.concentracion,
                formaFarmaceutica: detalle.formaFarmaceutica,
                dosis: detalle.dosis,
                frecuencia: detalle.frecuencia,
                duracion: detalle.duracion,
                cantidad: detalle.cantidad,
                viaAdministracion: detalle.viaAdministracion,
                observaciones: detalle.observaciones,
              })),
            };
          }),
    );

    return {
      paciente: {
        id: paciente.id,
        tipoDocumento: paciente.tipoDocumento,
        numeroDocumento: paciente.numeroDocumento,
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        fechaNacimiento: paciente.fechaNacimiento,
      },

      informacionClinica: {
        historiaClinicaId: paciente.historiaClinica.id,
        grupoSanguineo: paciente.historiaClinica.grupoSanguineo,
        alergias: paciente.historiaClinica.alergias,

        diagnosticosActivos: paciente.historiaClinica.diagnosticosPaciente.map(
          (diagnostico) => ({
            id: diagnostico.id,
            nombre: diagnostico.nombre,
            codigoCie10: diagnostico.codigoCie10,
            tipo: diagnostico.tipo,
            requiereEsquema: diagnostico.requiereEsquema,
            fechaDiagnostico: diagnostico.fechaDiagnostico,
          }),
        ),
      },

      totalFormulacionesVigentes: formulacionesVigentes.length,

      totalMedicamentos: formulacionesVigentes.reduce(
        (total, formulacion) => total + formulacion.medicamentos.length,
        0,
      ),

      formulacionesVigentes,
    };
  }
}
