import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateDispensationDto } from '../dto/create-dispensation.dto';
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

    // HU-024 - Evitar doble dispensación.
    const periodoAnio = ahora.getFullYear();
    const periodoMes = ahora.getMonth() + 1;

    const dispensacionExistente =
      await this.dispensationsRepository.findDispensationForPeriod(
        paciente.id,
        detalle.id,
        periodoAnio,
        periodoMes,
      );

    if (dispensacionExistente) {
      throw new ConflictException({
        valida: false,
        codigo: 'MEDICAMENTO_YA_DISPENSADO',
        mensaje:
          'Ya se realizó la entrega de este medicamento para el período actual.',
        periodo: {
          anio: periodoAnio,
          mes: periodoMes,
        },
        entregaAnterior: {
          dispensacionId: dispensacionExistente.dispensacion.id,
          numeroDispensacion:
            dispensacionExistente.dispensacion.numeroDispensacion,
          fechaDispensacion:
            dispensacionExistente.dispensacion.fechaDispensacion,
          cantidadEntregada: dispensacionExistente.cantidadEntregada,
          numeroLote: dispensacionExistente.lote.numeroLote,
          bodega: dispensacionExistente.dispensacion.bodega.nombre,
          sede: dispensacionExistente.dispensacion.bodega.sede.nombre,
          dispensadoPor:
            dispensacionExistente.dispensacion.dispensadoPor.nombre,
        },
      });
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

      periodoDispensacion: {
        anio: periodoAnio,
        mes: periodoMes,
      },

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

  // HU-025 - Registrar dispensación.
  async createDispensation(dto: CreateDispensationDto) {
    /*
     * Reutilizamos HU-023 y HU-024 antes de registrar:
     * valida paciente, formulación, vigencia, cantidad,
     * inventario, FEFO y doble dispensación.
     */
    await this.validateDispensation({
      numeroDocumento: dto.numeroDocumento,
      formulacionId: dto.formulacionId,
      detalleFormulacionId: dto.detalleFormulacionId,
      cantidad: dto.cantidad,
      bodegaId: dto.bodegaId,
    });

    const documento = dto.numeroDocumento.trim();

    const paciente =
      await this.dispensationsRepository.findPatientByDocument(documento);

    if (!paciente) {
      throw new NotFoundException('No se encontró el paciente indicado');
    }

    const detalle = await this.dispensationsRepository.findFormulationDetail(
      dto.formulacionId,
      dto.detalleFormulacionId,
    );

    if (!detalle) {
      throw new NotFoundException(
        'No se encontró el medicamento de la formulación',
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
        'El medicamento no se encuentra asociado al catálogo clínico',
      );
    }

    const usuario = await this.dispensationsRepository.findUserById(
      dto.usuarioId,
    );

    if (!usuario) {
      throw new NotFoundException(
        'No se encontró el usuario que realiza la dispensación',
      );
    }

    if (!usuario.activo) {
      throw new BadRequestException(
        'El usuario que realiza la dispensación se encuentra inactivo',
      );
    }

    const rolesFarmacia = [
      'REGENTE_FARMACIA',
      'AUXILIAR_FARMACIA',
      'QUIMICO_FARMACEUTICO',
      'ADMINISTRADOR',
    ];

    if (!rolesFarmacia.includes(usuario.rol)) {
      throw new BadRequestException(
        'El usuario no tiene un rol autorizado para realizar dispensaciones',
      );
    }

    const ahora = new Date();
    const periodoAnio = ahora.getFullYear();
    const periodoMes = ahora.getMonth() + 1;

    /*
     * Se vuelve a comprobar HU-024 justo antes de crear
     * la dispensación.
     */
    const dispensacionExistente =
      await this.dispensationsRepository.findDispensationForPeriod(
        paciente.id,
        detalle.id,
        periodoAnio,
        periodoMes,
      );

    if (dispensacionExistente) {
      throw new ConflictException({
        codigo: 'MEDICAMENTO_YA_DISPENSADO',
        mensaje:
          'Ya se realizó la entrega de este medicamento para el período actual.',
        periodo: {
          anio: periodoAnio,
          mes: periodoMes,
        },
        numeroDispensacion:
          dispensacionExistente.dispensacion.numeroDispensacion,
      });
    }

    try {
      const dispensacion =
        await this.dispensationsRepository.createDispensation(
          paciente.id,
          detalle.id,
          medicamento.id,
          dto.cantidad,
          dto.bodegaId,
          dto.usuarioId,
          periodoAnio,
          periodoMes,
          dto.observaciones,
        );

      return {
        registrada: true,
        mensaje: 'Dispensación registrada correctamente',
        dispensacion,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const mensaje =
        error instanceof Error
          ? error.message
          : 'No fue posible registrar la dispensación';

      throw new BadRequestException(mensaje);
    }
  }
}
