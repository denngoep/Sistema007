import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateDispensationDto } from '../dto/create-dispensation.dto';
import { RegisterDispensationSignatureDto } from '../dto/register-dispensation-signature.dto';
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

  async createDispensation(dto: CreateDispensationDto) {
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

  // HU-026 - Generar comprobante de dispensación.
  async generateReceipt(dispensacionId: number) {
    if (!Number.isInteger(dispensacionId) || dispensacionId <= 0) {
      throw new BadRequestException(
        'El identificador de la dispensación no es válido',
      );
    }

    const dispensacion =
      await this.dispensationsRepository.findDispensationById(dispensacionId);

    if (!dispensacion) {
      throw new NotFoundException('No se encontró la dispensación indicada');
    }

    if (dispensacion.estado !== 'CONFIRMADA') {
      throw new BadRequestException(
        'Solo se puede generar comprobante para una dispensación confirmada',
      );
    }

    if (dispensacion.numeroComprobante && dispensacion.fechaComprobante) {
      return {
        generado: true,
        mensaje: 'La dispensación ya cuenta con un comprobante generado',
        comprobante: {
          numeroComprobante: dispensacion.numeroComprobante,
          fechaComprobante: dispensacion.fechaComprobante,
          numeroDispensacion: dispensacion.numeroDispensacion,
          fechaDispensacion: dispensacion.fechaDispensacion,
          paciente: {
            id: dispensacion.paciente.id,
            tipoDocumento: dispensacion.paciente.tipoDocumento,
            numeroDocumento: dispensacion.paciente.numeroDocumento,
            nombres: dispensacion.paciente.nombres,
            apellidos: dispensacion.paciente.apellidos,
          },
          sede: dispensacion.bodega.sede.nombre,
          bodega: dispensacion.bodega.nombre,
          dispensadoPor: dispensacion.dispensadoPor,
          medicamentos: dispensacion.detalles.map((detalle) => ({
            medicamento: detalle.detalleFormulacion.medicamento,
            concentracion: detalle.detalleFormulacion.concentracion,
            formaFarmaceutica: detalle.detalleFormulacion.formaFarmaceutica,
            cantidadEntregada: detalle.cantidadEntregada,
            numeroLote: detalle.lote.numeroLote,
            fechaVencimiento: detalle.lote.fechaVencimiento,
          })),
        },
      };
    }

    const ahora = new Date();

    const numeroComprobante = `COMP-${ahora.getFullYear()}${String(
      ahora.getMonth() + 1,
    ).padStart(2, '0')}${String(ahora.getDate()).padStart(
      2,
      '0',
    )}-${dispensacion.id}-${Date.now()}`;

    const dispensacionActualizada =
      await this.dispensationsRepository.generateReceipt(
        dispensacion.id,
        numeroComprobante,
        ahora,
      );

    return {
      generado: true,
      mensaje: 'Comprobante generado correctamente',

      comprobante: {
        numeroComprobante: dispensacionActualizada.numeroComprobante,
        fechaComprobante: dispensacionActualizada.fechaComprobante,

        numeroDispensacion: dispensacionActualizada.numeroDispensacion,
        fechaDispensacion: dispensacionActualizada.fechaDispensacion,

        paciente: {
          id: dispensacionActualizada.paciente.id,
          tipoDocumento: dispensacionActualizada.paciente.tipoDocumento,
          numeroDocumento: dispensacionActualizada.paciente.numeroDocumento,
          nombres: dispensacionActualizada.paciente.nombres,
          apellidos: dispensacionActualizada.paciente.apellidos,
        },

        sede: dispensacionActualizada.bodega.sede.nombre,
        bodega: dispensacionActualizada.bodega.nombre,

        dispensadoPor: dispensacionActualizada.dispensadoPor,

        medicamentos: dispensacionActualizada.detalles.map((detalle) => ({
          medicamento: detalle.detalleFormulacion.medicamento,
          concentracion: detalle.detalleFormulacion.concentracion,
          formaFarmaceutica: detalle.detalleFormulacion.formaFarmaceutica,
          cantidadEntregada: detalle.cantidadEntregada,
          numeroLote: detalle.lote.numeroLote,
          fechaVencimiento: detalle.lote.fechaVencimiento,
        })),
      },
    };
  }

  // HU-027 - Registrar firma del paciente como evidencia de la dispensación.
  async registerSignature(
    dispensacionId: number,
    dto: RegisterDispensationSignatureDto,
  ) {
    if (!Number.isInteger(dispensacionId) || dispensacionId <= 0) {
      throw new BadRequestException(
        'El identificador de la dispensación no es válido',
      );
    }

    const dispensacion =
      await this.dispensationsRepository.findDispensationById(dispensacionId);

    if (!dispensacion) {
      throw new NotFoundException('No se encontró la dispensación indicada');
    }

    if (dispensacion.estado !== 'CONFIRMADA') {
      throw new BadRequestException(
        'Solo se puede registrar la firma de una dispensación confirmada',
      );
    }

    if (!dispensacion.numeroComprobante || !dispensacion.fechaComprobante) {
      throw new BadRequestException(
        'La dispensación debe tener un comprobante generado antes de registrar la firma del paciente',
      );
    }

    /*
     * La evidencia de la dispensación no debe sobrescribirse.
     * Una vez registrada la firma, forma parte de la trazabilidad
     * de la entrega realizada al paciente.
     */
    if (
      dispensacion.tipoFirma ||
      dispensacion.firmaPaciente ||
      dispensacion.soporteFirmado ||
      dispensacion.fechaFirma
    ) {
      throw new ConflictException({
        codigo: 'EVIDENCIA_DISPENSACION_YA_REGISTRADA',
        mensaje: 'La dispensación ya cuenta con evidencia de firma registrada.',
        evidencia: {
          tipoFirma: dispensacion.tipoFirma,
          fechaFirma: dispensacion.fechaFirma,
          fechaCargaSoporte: dispensacion.fechaCargaSoporte,
        },
      });
    }

    if (dto.tipoFirma === 'DIGITAL') {
      const firmaPaciente = dto.firmaPaciente?.trim();

      if (!firmaPaciente) {
        throw new BadRequestException(
          'La firma digital del paciente es obligatoria',
        );
      }

      if (dto.soporteFirmado?.trim()) {
        throw new BadRequestException(
          'Una firma digital no debe incluir soporte manual',
        );
      }

      const fechaFirma = new Date();

      const actualizada =
        await this.dispensationsRepository.registerDigitalSignature(
          dispensacion.id,
          firmaPaciente,
          fechaFirma,
        );

      return {
        registrada: true,
        mensaje: 'Firma digital del paciente registrada correctamente',

        evidenciaDispensacion: {
          dispensacionId: actualizada.id,
          numeroDispensacion: actualizada.numeroDispensacion,
          numeroComprobante: actualizada.numeroComprobante,
          tipoFirma: actualizada.tipoFirma,
          fechaFirma: actualizada.fechaFirma,
          fechaCargaSoporte: actualizada.fechaCargaSoporte,

          paciente: {
            id: actualizada.paciente.id,
            tipoDocumento: actualizada.paciente.tipoDocumento,
            numeroDocumento: actualizada.paciente.numeroDocumento,
            nombres: actualizada.paciente.nombres,
            apellidos: actualizada.paciente.apellidos,
          },

          sede: actualizada.bodega.sede.nombre,
          bodega: actualizada.bodega.nombre,
          dispensadoPor: actualizada.dispensadoPor,
        },
      };
    }

    if (dto.tipoFirma === 'MANUAL') {
      const soporteFirmado = dto.soporteFirmado?.trim();

      if (!soporteFirmado) {
        throw new BadRequestException(
          'El soporte firmado por el paciente es obligatorio para una firma manual',
        );
      }

      if (dto.firmaPaciente?.trim()) {
        throw new BadRequestException(
          'Una firma manual no debe incluir una firma digital',
        );
      }

      if (!dto.fechaFirma) {
        throw new BadRequestException(
          'La fecha real de la firma es obligatoria cuando el soporte fue firmado manualmente',
        );
      }

      const fechaFirma = new Date(dto.fechaFirma);

      if (Number.isNaN(fechaFirma.getTime())) {
        throw new BadRequestException(
          'La fecha de firma indicada no es válida',
        );
      }

      const fechaCargaSoporte = new Date();

      if (fechaFirma > fechaCargaSoporte) {
        throw new BadRequestException(
          'La fecha de firma no puede ser posterior a la fecha de carga del soporte',
        );
      }

      const actualizada =
        await this.dispensationsRepository.registerManualSignatureSupport(
          dispensacion.id,
          soporteFirmado,
          fechaFirma,
          fechaCargaSoporte,
        );

      return {
        registrada: true,
        mensaje: 'Soporte firmado manualmente registrado correctamente',

        evidenciaDispensacion: {
          dispensacionId: actualizada.id,
          numeroDispensacion: actualizada.numeroDispensacion,
          numeroComprobante: actualizada.numeroComprobante,
          tipoFirma: actualizada.tipoFirma,
          soporteFirmado: actualizada.soporteFirmado,
          fechaFirma: actualizada.fechaFirma,
          fechaCargaSoporte: actualizada.fechaCargaSoporte,

          paciente: {
            id: actualizada.paciente.id,
            tipoDocumento: actualizada.paciente.tipoDocumento,
            numeroDocumento: actualizada.paciente.numeroDocumento,
            nombres: actualizada.paciente.nombres,
            apellidos: actualizada.paciente.apellidos,
          },

          sede: actualizada.bodega.sede.nombre,
          bodega: actualizada.bodega.nombre,
          dispensadoPor: actualizada.dispensadoPor,
        },
      };
    }

    throw new BadRequestException('El tipo de firma debe ser DIGITAL o MANUAL');
  }
}
