import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ValidateDispensationDto } from '../dto/validate-dispensation.dto';
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

  async validateDispensation(dto: ValidateDispensationDto) {
    const documento = dto.numeroDocumento?.trim();

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

    const detalle = await this.dispensationsRepository.findFormulationDetail(
      dto.formulacionId,
      dto.detalleFormulacionId,
    );

    if (!detalle) {
      throw new NotFoundException(
        'El medicamento indicado no pertenece a la formulación seleccionada',
      );
    }

    const pacienteFormulacion =
      detalle.formulacion.atencionClinica.historiaClinica.paciente;

    if (pacienteFormulacion.id !== paciente.id) {
      throw new BadRequestException(
        'La formulación seleccionada no pertenece al paciente indicado',
      );
    }

    if (detalle.formulacion.estado !== 'VIGENTE') {
      throw new BadRequestException('La formulación no se encuentra vigente');
    }

    const fechaInicio = new Date(detalle.formulacion.fechaFormulacion);
    const fechaFinVigencia = new Date(fechaInicio);

    fechaFinVigencia.setMonth(
      fechaFinVigencia.getMonth() + detalle.formulacion.vigenciaMeses,
    );

    const ahora = new Date();

    if (ahora >= fechaFinVigencia) {
      throw new BadRequestException(
        'La vigencia de la formulación ya finalizó',
      );
    }

    if (dto.cantidad > detalle.cantidad) {
      throw new BadRequestException(
        `La cantidad solicitada (${dto.cantidad}) supera la cantidad formulada (${detalle.cantidad})`,
      );
    }

    const medicamento =
      await this.dispensationsRepository.findClinicalMedication(
        detalle.medicamento,
        detalle.concentracion,
        detalle.formaFarmaceutica,
      );

    if (!medicamento) {
      throw new NotFoundException(
        'El medicamento formulado no se encuentra asociado al catálogo clínico',
      );
    }

    const existencias = await this.dispensationsRepository.findDispensableStock(
      medicamento.id,
      dto.bodegaId,
      ahora,
    );

    const stockDisponible = existencias.reduce(
      (total, existencia) => total + existencia.cantidad,
      0,
    );

    if (stockDisponible <= 0) {
      throw new BadRequestException(
        'No existe stock dispensable para este medicamento en la bodega seleccionada',
      );
    }

    if (stockDisponible < dto.cantidad) {
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${stockDisponible}, solicitado: ${dto.cantidad}`,
      );
    }

    let cantidadPendiente = dto.cantidad;

    const lotesSugeridos = existencias
      .map((existencia) => {
        if (cantidadPendiente <= 0) {
          return null;
        }

        const cantidadTomar = Math.min(existencia.cantidad, cantidadPendiente);

        cantidadPendiente -= cantidadTomar;

        return {
          existenciaId: existencia.id,
          loteId: existencia.lote.id,
          numeroLote: existencia.lote.numeroLote,
          fechaVencimiento: existencia.lote.fechaVencimiento,
          productoInventarioId: existencia.lote.productoInventario.id,
          codigoInterno: existencia.lote.productoInventario.codigoInterno,
          codigoBarras: existencia.lote.productoInventario.codigoBarras,
          descripcion: existencia.lote.productoInventario.descripcion,
          cantidadDisponible: existencia.cantidad,
          cantidadSugerida: cantidadTomar,
        };
      })
      .filter((lote) => lote !== null);

    const primeraExistencia = existencias[0];

    return {
      valida: true,
      mensaje:
        'La entrega cumple las condiciones para continuar con la dispensación',

      paciente: {
        id: paciente.id,
        tipoDocumento: paciente.tipoDocumento,
        numeroDocumento: paciente.numeroDocumento,
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
      },

      formulacion: {
        id: detalle.formulacion.id,
        fechaFormulacion: detalle.formulacion.fechaFormulacion,
        vigenciaMeses: detalle.formulacion.vigenciaMeses,
        fechaFinVigencia,
      },

      medicamento: {
        detalleFormulacionId: detalle.id,
        medicamentoId: medicamento.id,
        nombre: detalle.medicamento,
        concentracion: detalle.concentracion,
        formaFarmaceutica: detalle.formaFarmaceutica,
        dosis: detalle.dosis,
        frecuencia: detalle.frecuencia,
        viaAdministracion: detalle.viaAdministracion,
        cantidadFormulada: detalle.cantidad,
        cantidadAValidar: dto.cantidad,
      },

      inventario: {
        bodegaId: dto.bodegaId,
        bodega: primeraExistencia.bodega.nombre,
        sede: primeraExistencia.bodega.sede.nombre,
        stockDisponible,
        estrategiaSeleccion: 'FEFO',
        lotesSugeridos,
      },
    };
  }
}
